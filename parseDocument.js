const elasticsearch = require('elasticsearch');
const EPub = require('epub');
const client = new elasticsearch.Client({
	requestTimeout: 120000,
	hosts: ['http://localhost:9200']
});

process.on('message', message => {
	indexObject(message.archiveName, message.archiveDir, message.object).then(function(returnMessage){
		process.send(returnMessage);
		process.exit();
	});
});

function indexObject(archiveName, archiveDir, object) {
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
					process.send(err);
					process.exit();
				}
				var endExecutionTime = new Date();
				var executionTime = Math.abs(startExecutionTime.getTime() - endExecutionTime.getTime());
				resolve(executionTime+"ms > "+ object.value.id + " (" + object.value.title + ")\n");
			});	
		}).catch(function(err){
			process.send("Story Error: "+ err);
			setTimeout(function(){
				indexObject(archiveName, object)
			}, 1000);
		});
	});
}

function getStoryData(storyDir) {
	return new Promise(function(resolve, reject){
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
					process.send("Chapter Error: "+ err)
					setTimeout(function(){
						getStoryData(storyDir).then(data => resolve(data));
					}, 1000);
				});
			})
	 	} catch (err) {
			process.send("Story Error: " + err);
			setTimeout(function(){
				getStoryData(storyDir).then(data => resolve(data));
			}, 1000);
		};
	});
}