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

fs.readdir(archiveDir, function(err, items) {
	items.forEach(function(item) {
		fs.createReadStream(archiveDir+item+"/index.json").pipe(parser()).pipe(streamObject()).on("data", function(object){
			/*client.index({
		      index: 'fimfarchive-20181201',
		      id: object.value.id,
		      type: 'story',
		      body: getStoryData(object.value)
		    });*/
		    console.log(archiveDir+item+"/"+object.value.archive.path)
		    console.log(getStoryData(archiveDir+item+"/"+object.value.archive.path, object.value))
		});
	})
});

function getStoryData(storyDir, storyObject) {
	var storyPromises = [];
	var epub = new EPub(storyObject.archive.path, "/images/", "/links/");
	epub.parse();
	epub.on("end", function(){
		storyObject.story = {};
		var chapterPromises = [];
		var lastSafeID;

		// epub is now usable
		storyObject.story.metadata = epub.metadata;
		storyObject.story.chapters = {};
		epub.flow.forEach(function(chapter){
			chapterPromises.push(
				new Promise(function(resolve, reject){
					if (chapter.order != undefined) {
						lastSafeID = chapter.order;
						storyObject.story.chapters[lastSafeID] = {};
						storyObject.story.chapters[lastSafeID].title = chapter.title;
					}
					epub.getChapter(chapter.id, function(error, text){
						//storyObject.story.chapters[lastSafeID].text += text;
						resolve();
					});
				})
			);
		});
		Promise.all(chapterPromises).then(function(results) {
		    return storyObject;
		}).catch(function(err){
			console.log("Chapter Error: "+ err)
		});
	});
}