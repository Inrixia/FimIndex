var fs = require('graceful-fs')
var realFs = require('fs')
fs.gracefulify(realFs)
const EPub = require("epub");
const elasticsearch = require('elasticsearch');
const readline = require('readline');
const {streamObject} = require('stream-json/streamers/StreamObject');
const {parser} = require('stream-json');

const client = new elasticsearch.Client({
	requestTimeout: 1200000,
	hosts: ['http://localhost:9200']
});

const archiveDir = "./archives/";

var indexCheckPromises = [];

var errorsOccoured = 0;

var queued = 0;

var maxFilesOpen = 50; // The starting max files to stay under
var currentOpenFiles = 0;

fs.readdir(archiveDir, function(err, items) {
	items.forEach(function(archiveName) {
		client.indices.exists({index: archiveName}, function(err, exists){
			if(!exists) client.indices.create({
				index: archiveName,
				"index.mapping.total_fields.limit": 1000000,
			 	"index.mapping.depth.limit": 1000000, 
			 	"index.mapping.nested_fields.limit": 1000000
			}, function(){parseArchive(archiveName)});
			else parseArchive(archiveName);
		})
	})
});

function parseArchive(archiveName) {
	getExistingItems(archiveName).then(function(existingItems){
		fs.createReadStream(archiveDir+archiveName+"/index.json").pipe(parser()).pipe(streamObject()).on("data", function(object){
			if(existingItems[object.value.id]) process.stdout.write("Exists > "+object.value.id + " (" + object.value.title + ")\n");
			else {
				queued += 1;
				indexObject(archiveName, object).then(function(){delete object;});
			}
		});
	});
}

function getExistingItems(indexName) {
	return new Promise(function(resolve, reject){
		var existingIndex = {};
		var promises = [];
		var indexCount = 0;
		client.search({
		  index: indexName,
		  scroll: '10m',
		  body: {
		 	stored_fields: [],
			query: {
				match_all: {}
			},
			size: 1000
		  }
		}, function getMoreUntilDone(error, data) {
			data.hits.hits.forEach(function(hit){
			    promises.push(new Promise(function(resolve, reject){
			    	existingIndex[hit._id] = true;
			    	indexCount += 1;
			    	resolve();
			    }))
			})
			if (data.hits.total !== indexCount) {
		    	client.scroll({
		  			scrollId: data._scroll_id,
						scroll: '10m'
		    	}, getMoreUntilDone);
		  	} else {
		    	Promise.all(promises).then(function(){resolve(existingIndex)});
		  	}
		});
	});
}

function indexObject(archiveName, object) {
	return new Promise(function(resolve, reject){
		getStoryData(archiveDir+archiveName+"/"+object.value.archive.path).then(function(storyObject){
			var startExecutionTime = storyObject.startExecutionTime;
			delete storyObject.startExecutionTime;
			object.value.story = storyObject;
			client.index({
				index: archiveName,
				id: object.value.id,
				type: 'story',
				body: object.value
			}, function(err, response){
				if(err){
					console.log(err);
					process.exit();
					/*
					errorsOccoured += 1;
					setTimeout(function(){
						errorsOccoured -= 1;
						indexObject(archiveName, object)
					}, 1000*errorsOccoured);
					*/
				}
				resolve();
				var endExecutionTime = new Date();
				var executionTime = Math.abs(startExecutionTime.getTime() - endExecutionTime.getTime());
				currentOpenFiles -= 1;
				queued -= 1;
				process.stdout.write(queued+" Queue, "+currentOpenFiles+"/"+maxFilesOpen+" Open | "+executionTime+"ms > "+object.value.id + " (" + object.value.title + ")\n");
			});	
		}).catch(function(err){
			console.log("Story Error: "+ err);
			errorsOccoured += 1;
			setTimeout(function(){
				errorsOccoured -= 1;
				indexObject(archiveName, object)
			}, 1000*errorsOccoured);
		});
	});
}

function getStoryData(storyDir) {
	return new Promise(function(resolve, reject){
		var fileWatcher = new setInterval(function(){
			if (currentOpenFiles < maxFilesOpen) {
				currentOpenFiles += 1;
				var storyPromises = [];
				try {
					var subStoryObject = {
						startExecutionTime: new Date()
					}
					var epub = new EPub(storyDir, "/images/", "/links/");
				 	epub.parse()
					epub.on("end", function(){
						var chapterPromises = [];
						var lastSafeID;

						// epub is now usable
						subStoryObject.metadata = epub.metadata;
						subStoryObject.chapters = {};
						subStoryObject.fullStoryText = "";
						epub.flow.forEach(function(chapter){
							chapterPromises.push(
								new Promise(function(resolve, reject){
									if (chapter.order != undefined) {
										lastSafeID = chapter.order;
										subStoryObject.chapters[lastSafeID] = {};
										subStoryObject.chapters[lastSafeID].title = chapter.title;
									}
									epub.getChapter(chapter.id, function(error, text){
										if (text != undefined) {
											subStoryObject.chapters[lastSafeID].text += text;
											subStoryObject.fullStoryText += text;
										}
										resolve();
									});
								})
							);
						});
						Promise.all(chapterPromises).then(function(results){
							resolve(subStoryObject);
						}).catch(function(err){
							console.log("Chapter Error: "+ err)
							errorsOccoured += 1;
							setTimeout(function(){
								errorsOccoured -= 1;
								currentOpenFiles -= 1;
								getStoryData(storyDir).then(data => resolve(data));
							}, 1000*errorsOccoured);
						});
					})
			 	} catch (err) {
					console.log("Story Error: " + err);
					errorsOccoured += 1;
					setTimeout(function(){
						errorsOccoured -= 1;
						currentOpenFiles -= 1;
						getStoryData(storyDir).then(data => resolve(data));
					}, 1000*errorsOccoured);
				};
				clearInterval(fileWatcher);
			}
		}, 1000)
	});
}