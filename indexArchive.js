const EPub = require("epub");
const fs = require('fs');
const elasticsearch = require('elasticsearch');
const {streamObject} = require('stream-json/streamers/StreamObject');
const {parser} = require('stream-json');

const client = new elasticsearch.Client({
	requestTimeout: 1200000,
	hosts: ['http://localhost:9200']
});

const archiveDir = "./archives/";

var indexCheckPromises = [];

fs.readdir(archiveDir, function(err, items) {
	items.forEach(function(archiveName) {
		client.indices.exists({index: archiveName}, function(err, exists){
			if(!exists) client.indices.create({index: archiveName}, function(){parseArchive(archiveName)});
			else parseArchive(archiveName);
		})
	})
});

function parseArchive(archiveName) {
	fs.createReadStream(archiveDir+archiveName+"/index.json").pipe(parser()).pipe(streamObject()).on("data", function(object){
	    getStoryData(archiveDir+archiveName+"/"+object.value.archive.path).then(function(storyObject){
	    	object.value.story = storyObject;
	    	client.index({
				index: archiveName,
				id: object.value.id,
				type: 'story',
				body: object.value
		    }, function(err, response) {
		    	if(err) console.log("Index Error: " + err);
		    	else console.log(object.value.title + " ("+object.value.id+") - Done")
		    });
	    }).catch(function(err){
			console.log("Story Error: "+ err);
		});
	});
}

function getStoryData(storyDir) {
	return new Promise(function(resolve, reject){
		var storyPromises = [];
		var epub = new EPub(storyDir, "/images/", "/links/");
		epub.parse();
		epub.on("end", function(){
			var subStoryObject = {};
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
			});
		});
	});
}