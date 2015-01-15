var Hapi = require('hapi');
var Joi  = require('joi');
var Q = require('q');
var Helpers = require('./helpers');

var server = new Hapi.Server('0.0.0.0', '8000');

// Sample request
// curl -F "file=~/Downloads/r4.pdf" -i http://localhost:8000/pngfy

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
		validate: {
			payload: {
				file: Joi.string().regex(/(.pdf$|.pdf\z)/).required()
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
