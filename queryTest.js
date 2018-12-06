const elasticsearch = require('elasticsearch');
const fs = require('fs');
const {streamObject} = require('stream-json/streamers/StreamObject');
const {parser} = require('stream-json');
const client = new elasticsearch.Client({
	requestTimeout: 10000,
	hosts: ['http://localhost:9200']
});

function getExistingItems(indexName) {
	return new Promise(function(resolve, reject){
		var existingIndex = [];
		var promises = [];
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
			    	resolve(existingIndex.push(hit._id));
			    }))
			})
			if (data.hits.total !== existingIndex.length) {
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

//getExistingItems('fimfarchive-20181201').then(data => console.log(1000 in data));

/*
var idIndex = [];

fs.createReadStream("./archives/fimfarchive-20181201/index.json").pipe(parser()).pipe(streamObject()).on("data", function(object){
	if (object.value.id in idIndex) console.log("Fuck > "+object.value.id);
	else idIndex.push(object.value.id);
});*/

client.indices.putSettings({index: "fimfarchive-20181201", body: {"index.mapping.total_fields.limit": 1000000, "index.mapping.depth.limit": 1000000, "index.mapping.nested_fields.limit": 1000000}}, function(err, data){
	console.log(err, data)
	client.indices.getSettings({}, function(err, data){console.log(err, JSON.stringify(data))});
})
