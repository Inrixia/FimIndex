const { fork } = require('child_process');
const fs = require('graceful-fs');
const elasticsearch = require('elasticsearch');
const {streamObject} = require('stream-json/streamers/StreamObject');
const {parser} = require('stream-json');

const client = new elasticsearch.Client({
	requestTimeout: 1200000,
	hosts: ['http://localhost:9200']
});

const archiveDir = "./archives/";

var liveChildren = 0;
var maxChildren = 200;

var trueIndex = 0;

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
			trueIndex++;
			if(existingItems[object.value.id]) process.stdout.write(liveChildren+" Running | Exists > "+trueIndex+ ' - "' + object.value.title + '" (' + object.value.id + ")\n");
			else {
				//var spawnChild = setInterval(function(){
					//if (liveChildren < maxChildren) {
				//clearInterval(spawnChild);
				liveChildren += 1;
				var parseDoc = fork('parseDocument.js');
				parseDoc.send({archiveName: archiveName, archiveDir: archiveDir, object: object});
				parseDoc.on('message', result => {
					process.stdout.write(liveChildren+" Running | Done "+result);
				});
				parseDoc.on('exit', code => {
					liveChildren -= 1;
				});
					//}
				//}, 1000)
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