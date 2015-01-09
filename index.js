var Hapi = require('hapi');
var Joi  = require('joi');

var server = new Hapi.Server('0.0.0.0', '8000');

// Sample request
// curl -F "file=~/Downloads/instructions.pdf" -i http://localhost:8000/pngfy

server.route({
	method: 'POST',
	path: '/pngfy',
	config: {
		handler: function(request, reply){
			var data = request.payload;
			var file = data.file;

			var command = "convert -density 500 " + file + " -resize 25% a.png"

			var exec = require('child_process').exec, child;

			child = exec(command,
			  function (error, stdout, stderr) {
			    console.log('stdout: ' + stdout);
			    console.log('stderr: ' + stderr);
			    if (error !== null) {
			      console.log('exec error: ' + error);
			    }
			});

			reply('Links go here');
		}
	}
});

server.start();
console.log('Server Started On localhost:8000');
