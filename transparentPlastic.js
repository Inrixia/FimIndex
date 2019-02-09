var http = require('http');
var httpProxy = require('http-proxy');
var util = require('util')
const proxy = httpProxy.createProxyServer({});
const JSON = require('circular-json');
const elasticsearch = require('elasticsearch');
const client = new elasticsearch.Client({
	requestTimeout: 120000,
	hosts: ['http://localhost:9200']
});

http.createServer(function(req, res) {
	let body = '';
	let rawMethod = req.method;
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        client.index({
			index: "web_requests",
			type: 'request',
			body: {ip: req.connection.remoteAddress, url: req.url, method: rawMethod, headers: req.headers, time: new Date(), body: body }
		}, function(err, resposne){
			if (err) console.log(err);
		});
		console.log(req.connection.remoteAddress+req.url+" | "+req.method+"=>GET\n", req.headers, "\n", body)
    });
	req.method = "GET";
    proxy.web(req, res, { target: 'http://127.0.0.1:9200' });
}).listen(7667);

http.createServer(function(req, res) {
	var allowedAccess = ["::ffff:151.33.85.166", "::ffff:60.234.16.126", "::ffff:155.4.1.250", "::ffff:173.94.70.102"]
	let body = '';
	let rawMethod = req.method;
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        client.index({
			index: "kibana_web_requests",
			type: 'request',
			body: {ip: req.connection.remoteAddress, url: req.url, method: rawMethod, headers: req.headers, time: new Date(), body: body, allowedAccess: (allowedAccess.indexOf(req.connection.remoteAddress) > -1) }
		}, function(err, resposne){
			if (err) console.log(err);
		});
    });
	if (allowedAccess.indexOf(req.connection.remoteAddress) > -1) {
		proxy.web(req, res, { target: 'http://11.0.0.6:5601' });
	} else {
		res.writeHead(403, { 'Content-Type': 'text/plain' });
		res.write('Access Deined');
		res.end();
	}
}).listen(6776);