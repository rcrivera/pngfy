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
				function(response){
					console.log(response);
					reply(response);
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
  path: '/thumbs/{thumb_name}/{page?}',
  handler: function (request, reply) {
  	var thumb_name = encodeURIComponent(request.params.thumb_name);
  	var page = request.params.page ? encodeURIComponent(request.params.page) : false;
  	helpers.getKey(thumb_name,page).done(function (response){
  		reply(response);
  	});
  }
});

server.start();
console.log('Server Started On localhost:8000');
