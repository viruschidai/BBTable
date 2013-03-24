
/**
 * Module dependencies.
 */

var express = require('express')
, routes = require('./routes')
, user = require('./routes/user')
, http = require('http')
, path = require('path')
, __ = require('underscore')
;

var app = express();

app.configure(function(){
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
app.use(express.errorHandler());
});

app.get('/', routes.index);
app.get('/users', user.list);

var collection = [];

for (var i=0; i<1000; i++) {
	collection.push({'id': i, 'name': 'name' + i, 'value': 'value' + i});
}

app.get('/collection/', function(req, res) {
	res.json(collection);
});

app.param('id', function(req, res, next, id) {
	console.log("id = " + id);
	var item = __.find(collection, function(item) {return item.id == id;});
	req.item = item;
	next();
});

app.get('/collection/:id', function(req, res, id) {
	res.json(req.item);
});

http.createServer(app).listen(app.get('port'), function(){
console.log("Express server listening on port " + app.get('port'));
});
