const elasticsearch = require('elasticsearch');

const client = new elasticsearch.Client({
	requestTimeout: 1200000,
	hosts: ['http://localhost:9200']
});

client.indices.exists({index: "dim_wordfreq"}, function(err, exists){
	if(!exists) client.indices.create({
		index: "dim_wordfreq"
	}, function(){processItems("fimfarchive-20181201", "dim_wordfreq")});
	else processItems("fimfarchive-20181201", "dim_wordfreq")
});

var timeout = 0;

function processItems(indexName, freqName) {
	return new Promise(function(resolve, reject){
		var existingIndex = {};
		var promises = [];
		var indexCount = 0;
		client.termvectors(
		{
			termStatistics: true, 
			index: indexName, 
			type: "story", 
			id: 378287,
			fields: ["story.fullStoryText"],
			fieldStatistics: true, 
			offsets: false, 
			payloads: false, 
			positions: false,
			body: {
				"filter": {
				    "min_word_length": 2,
				    "min_term_freq": 0,
				    "min_doc_freq": 0,
				    "max_num_terms": 999999999
				  }
			} 
		}, function getMoreUntilDone(error, data) {
			getExistingItems(indexName).then(function(existingItems){
				var terms = data.term_vectors["story.fullStoryText"].terms;
				Object.keys(terms).forEach(function(freq) {
					timeout += 1;
					if(existingItems[freq]) console.log("Exists > "+freq);
					else sendDoc(freqName, freq, terms)
				});
			});
		});
	});
}

function sendDoc(freqName, freq, terms) {
	setTimeout(function() {
		client.index({
			index: freqName,
			id: freq,
			type: 'frequency',
			body: terms[freq]
		}, function(err, response){
			if(err) console.log(err);
			console.log("Done > "+freq)
		});	
	}, 2*timeout);	
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