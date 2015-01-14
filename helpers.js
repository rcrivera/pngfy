var fs = require('fs');
var aws = require('aws-sdk');
var path = require('path');
var Q = require('q');

aws.config.update({
	accessKeyId: process.env.PNGFY_AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.PNGFY_AWS_SECRET_ACCESS_KEY
});

var s3bucket = new aws.S3({params: {Bucket: process.env.PNGFY_AWS_BUCKET}});

module.exports = {
	convertToPng: function(file){
		var deferred = Q.defer();
		// Note: file names should not have spaces
		var fileName = path.basename(file).split(".")[0];
		
		var convertCommand = "convert " + file + " tmp/"+ fileName + ".png"
		var convertExec = require('child_process').exec, child;

		child = convertExec(convertCommand,
		  function (error, stdout, stderr) {
		    console.log('stdout: ' + stdout);
		    console.log('stderr: ' + stderr);
		    if (error !== null) {
		    	deferred.reject(err);
		    }
		    else{
		    	get_converted_files('./tmp')
		    	.then(upload_files, console.error)
		    	.done(function (files_urls){
		    		deferred.resolve(files_urls);
		    	});
		    }
			}
		);
		return deferred.promise;
	},

  getFile: function(key){
  	s3bucket.headObject({Key: key}, function (err, res) {
	    if (err) {
	    	console.log(err);
	    }
	    else{
	    	console.log(res);
	    	s3bucket.getSignedUrl('getObject', {Key: key}, function(err, url){
	    		url = url.substring(0, url.lastIndexOf("?"));
				  console.log('the url of the image is', url);
	    		return url;
				});  
	    }
		});
  }
};

var get_converted_files = function (dir){
	var deferred = Q.defer();
	fs.readdir('./tmp', function (err, files){
		if (err) {
			deferred.reject(err);
		}
		else {
			deferred.resolve(files.filter(filter_png));
		}
	});
	return deferred.promise;
}

var filter_png = function (file){
	if (path.extname(file) == '.png') return file;
}

var upload_files = function(files){
	var totalFiles = files.length;	
	var promises = [];
	for (var index in files) {
		promises.push(processFile(files[index], index, totalFiles).then(uploadFile));
	}
	return Q.all(promises);
}

var processFile = function (file, index, totalFiles) {
	var deferred = Q.defer();
	fs.readFile('./tmp/'+ file, function (err, data) {
	  if (err) {
	  	deferred.reject(err);
	  }
	  else {
	  	var fileName = totalFiles > 1 ? file.substring(0, file.lastIndexOf("-")) : path.basename(file).split(".")[0];
	  	var bucketFileName = fileName +'_thumb_'+index+'.png';
	  	var base64data = new Buffer(data, 'binary');
	  	deferred.resolve({key: bucketFileName, data: base64data, path: file});
	  }
	});
	return deferred.promise;
}

var uploadFile = function (params){
	var deferred = Q.defer();
	s3bucket.createBucket(function() {
	  var file = {Key: params['key'], Body: params['data']};
	  s3bucket.upload(file, function(err, data) {
	    if (err) {
	      console.log("Error uploading data: ", err);
	      deferred.reject(err);
	    } 
	    else {
	      console.log("Successfully uploaded " + params['key']);
	      fs.unlinkSync('./tmp/'+params['path']);
	      deferred.resolve(params['key']);
	    }
	  });
	});
	return deferred.promise;
}