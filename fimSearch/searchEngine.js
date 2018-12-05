var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 80;
var MongoClient = require('mongodb').MongoClient;
var url = "REDACTED";




MongoClient.connect(url, function(err, db) {
  	if (err) throw err;
  	console.log("Database opened!");

  	app.get('/', function(req, res){
	  res.sendFile(__dirname + '/index.html');
	});

	io.on('connection', function(socket){
	  socket.on('search', function(msg){
	  	db.db("spookelton").collection('fim').find( { $text: { $search: msg }}).project({ title: 1, description_html : 1, cover_image: 1, content_rating: 1, url: 1 }).limit(10).toArray(function(err, result) {
	    	io.emit('search_result', result);
		});
	  });
	});

	http.listen(port, function(){
  		console.log('listening on *:' + port);
	});
});