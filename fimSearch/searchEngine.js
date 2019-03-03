var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 8585;
var url = "REDACTED";
const elasticsearch = require('elasticsearch');
const client = new elasticsearch.Client({
	requestTimeout: 120000,
	hosts: ['http://localhost:9200']
});


app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});


function elasticEscape(string) {
	return string.replace(/[\*\+\-=~><\"\?^\${}\(\)\:\!\/[\]\\\s]/g, '\\$&') // replace single character special characters
    .replace(/\|\|/g, '\\||') // replace ||
    .replace(/\&\&/g, '\\&&') // replace &&
    .replace(/AND/g, '\\A\\N\\D') // replace AND
    .replace(/OR/g, '\\O\\R') // replace OR
    .replace(/NOT/g, '\\N\\O\\T'); // replace NOT
}

io.on('connection', function(socket){
  socket.on('search', function(searchObject){
  	var searchString = elasticEscape(searchObject.value);
  	var searchSlop = elasticEscape(searchObject.slop);
  	console.log(searchString, searchSlop)
  	var searchBody = {
		"_source": ["title", "cover_image", "short_description", "content_rating", "url", "author", "num_views", "num_words", "tags"], 
		"query": {
			"match_phrase": {
				"story.fullStoryText": { 
					"query": searchString,
					"analyzer": "search_analis",
					"slop": searchSlop
				}
			}
		},
		"highlight": {
			"fields": {
				"story.fullStoryText": {
					"pre_tags": "<b style='background-color: hsla(0, 100%, 50%, 0.4);'>",
        			"post_tags": "</b>"
				}
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