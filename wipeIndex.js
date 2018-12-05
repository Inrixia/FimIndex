const elasticsearch = require('elasticsearch');
const client = new elasticsearch.Client({
	requestTimeout: 1200000,
	hosts: ['http://localhost:9200']
});

client.indices.delete({index: "fimfarchive-20181201"}, function(err, response){console.log(err, response)});