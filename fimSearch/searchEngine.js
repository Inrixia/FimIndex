var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 25566;
var url = "REDACTED";
const elasticsearch = require('elasticsearch');
const client = new elasticsearch.Client({
	requestTimeout: 120000,
	hosts: ['http://localhost:9200']
});


app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket){
  socket.on('search', function(msg){
  	var searchBody = {
		"_source": ["title", "cover_image", "short_description", "content_rating", "url", "author", "num_views", "num_words", "tags"], 
		"query": {
			"match_phrase": {
				"story.fullStoryText": { 
					"query": msg,
					"analyzer": "search_analis",
					"slop": 2
				}
			}
		},
		"highlight": {
			"fields": {
				"story.fullStoryText": {}
			}
		}
	};
	client.search({index: 'fimarchive', body: searchBody}).then(data => {
		io.emit('search_result', data);
	})
  });
});

http.listen(port, function(){
	console.log('listening on *:' + port);
});