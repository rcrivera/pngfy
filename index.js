var Hapi = require('hapi');
var Joi  = require('joi');
var fs = require('fs');
var path = require('path');
var helpers = require('./helpers');

var server = new Hapi.Server('0.0.0.0', '8000');

// Sample request
// curl -F "file=~/Downloads/Ecolightpr.pdf" -i http://localhost:8000/pngfy

server.route({
	method: 'POST',
	path: '/pngfy',
	config: {
		handler: function(request, reply){
			var file = request.payload.file;
			var convert = helpers.convertToPng(file);
			reply('links go here');
		}
	}
});

server.route({
  method: 'GET',
  path: '/thumbs/{thumb_name}',
  handler: function (request, reply) {
  	helpers.getFile(encodeURIComponent(request.params.thumb_name));
  	reply('Hello!');
  }
});

server.start();
console.log('Server Started On localhost:8000');
