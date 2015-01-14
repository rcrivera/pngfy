var Hapi = require('hapi');
var Joi  = require('joi');
var fs = require('fs');
var path = require('path');
var helpers = require('./helpers');
var Q = require('q');

var server = new Hapi.Server('0.0.0.0', '8000');

// Sample request
// curl -F "file=~/Downloads/Ecolightpr.pdf" -i http://localhost:8000/pngfy

server.route({
	method: 'POST',
	path: '/pngfy',
	config: {
		handler: function(request, reply){
			var file = request.payload.file;
			helpers.convertToPng(file).done(
				function(file_urls){
					console.log(file_urls);
					reply(file_urls);
				}, 
				function(error){
					console.error(error);
					reply(error);
				}
			);
		}
	}
});

server.route({
  method: 'GET',
  path: '/thumbs/{thumb_name}',
  handler: function (request, reply) {
  	var url = helpers.getFile(encodeURIComponent(request.params.thumb_name));
  	reply(url);
  }
});

server.start();
console.log('Server Started On localhost:8000');
