var Hapi = require('hapi');
var Joi  = require('joi');
var Q = require('q');
var Helpers = require('./helpers');
var Fs = require('fs');
var Path = require('path');

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.HOST = process.env.HOST || 'http://localhost:8000';

console.log(process.env.HOST);

var port = process.env.NODE_ENV == 'production' ? '8080' : '8000';
var server = new Hapi.Server('0.0.0.0', port);

// Sample POST request
// curl -i -F file=@./instructions.pdf  http://localhost:8000/pngfy

server.route({
	method: 'POST',
	path: '/pngfy',
	handler: function(request, reply){
		var file = request.payload.file;

		Helpers.convertToPng(file).done(
			function(response){
				console.log(response);
				reply(response).type('application/json');
			}, 
			function(err){
				console.error(err);
				reply(err).type('application/json');
			}
		);
	},
	config: {
		payload: {
	    output: 'file',
	    parse: true,
	    allow: 'multipart/form-data'
    },
		validate: {
			payload: {
				file: Joi.object({
					filename: Joi.string().regex(/(.pdf$|.pdf\z)/),
					path: Joi.string(),
					headers: Joi.object({
						'content-disposition': Joi.string(),
						'content-type': Joi.string(),
					}),
					bytes: Joi.number()
				})
			}
		}
	}
});

server.route({
  method: 'GET',
  path: '/thumbs/{thumb_name}/{page?}',
  handler: function (request, reply) {
  	var thumb_name = encodeURIComponent(request.params.thumb_name);
  	var page = request.params.page ? encodeURIComponent(request.params.page) : false;
  	Helpers.getKey(thumb_name,page).done(function (response){
  		if (page) {
  			reply(response).type('image/png');
  		}
  		else{
  			reply(response).type('application/json');
  		}
  	});
  },
  config: {
		validate: {
			params: {
				thumb_name: Joi.string().required(),
				page: Joi.string().regex(/(.png$|.png\z)/).optional()
			}
		}
	}
});

server.start();
console.log('Server Started On localhost:8000');
