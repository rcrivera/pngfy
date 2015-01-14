var fs = require('fs');
var aws = require('aws-sdk');
var path = require('path');
var Q = require('q');
var rimraf = require('rimraf');

aws.config.update({
	accessKeyId: process.env.PNGFY_AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.PNGFY_AWS_SECRET_ACCESS_KEY
});

var s3bucket = new aws.S3({params: {Bucket: process.env.PNGFY_AWS_BUCKET}});

module.exports = {
	convertToPng: function(file){
		var deferred = Q.defer();
		// Creates name for a temporary directory i.e. ./tmp/filename-1421207507
		var dir = generate_dir_name(file);

		create_tmp_directory(dir, file)
		.then(convert_pdf_to_png)
		.then(get_converted_files)
	  .then(upload_files)
	  .then(destroy_tmp_directory)
	  .done(function (files_urls){
	  	var response = {name: dir.split("/")[2], urls: files_urls};
  		deferred.resolve(response);
  	});

		return deferred.promise;
	},

  getKey: function(thumb_name, page){
  	var deferred = Q.defer();
  	if (page) {
  		var thumb = thumb_name + '/' + page;
  		s3bucket.getSignedUrl('getObject', {Key: thumb}, function(err, url){
  			if (err) {
		    	console.log(err);
		    	deferred.reject(err);
		    }
		    else {
		    	url = url.substring(0, url.lastIndexOf("?"));
    			deferred.resolve({url: url});
		    }
			});  
  	}
  	else{
  		s3bucket.listObjects({Marker: thumb_name}, function (err, res) {
		    if (err) {
		    	console.log(err);
		    	deferred.reject(err);
		    }
		    else {
		    	var files = res['Contents'];
		    	var response = {name: thumb_name, urls: []};
		    	files.map(function(file){
		    		response.urls.push(file['Key']);
		    	});
		    	deferred.resolve(response);
		  	}
  		});
  	}
  	return deferred.promise;
  }
}

var generate_dir_name = function(file){
	var fileName = path.basename(file).split(".")[0];
	var timestamp = Math.floor(new Date() / 1000); //Unix Timestamp
	return './tmp/'+fileName+'-'+timestamp+'/';
}

var create_tmp_directory = function (dirName, file){
	var deferred = Q.defer();
	fs.mkdir(dirName, function(error) {
		error ? deferred.reject(error) : deferred.resolve({dirName: dirName, file: file});
	});
	return deferred.promise;
}

var destroy_tmp_directory = function (params){
	var deferred = Q.defer();
	rimraf(params['path'], function(err){
		if (err) {
			deferred.reject(err);
		}
		else {
			deferred.resolve(params['files_urls']);
		}
	});
	return deferred.promise;
}

var convert_pdf_to_png = function (params){
	var deferred = Q.defer();
	var output_directory = params['dirName'];
	var file = params['file'];
	var output_file_name = output_directory.split("/")[2] + '.png';

	var convertCommand = "convert " + file + " " + output_directory + output_file_name;
	var convertExec = require('child_process').exec, child;

	child = convertExec(convertCommand,
	  function (error, stdout, stderr) {
	    console.log('stdout: ' + stdout);
	    console.log('stderr: ' + stderr);
	    if (error !== null) {
	    	deferred.reject(err);
	    }
	    else{
	    	deferred.resolve(output_directory);
	    }
		}
	);
	return deferred.promise;
}

var get_converted_files = function (dir){
	var deferred = Q.defer();
	fs.readdir(dir, function (err, files){
		if (err) {
			deferred.reject(err);
		}
		else {
			deferred.resolve({files: files.filter(filter_png), dir: dir});
		}
	});
	return deferred.promise;
}

var filter_png = function (file){
	if (path.extname(file) == '.png') return file;
}

var upload_files = function(params){
	var files = params['files'];
	var path = params['dir'];
	var totalFiles = files.length;	
	var promises = [];
	for (var index in files) {
		promises.push(processFile(path, files[index], index, totalFiles).then(uploadFile));
	}
	return Q.all(promises).then(function (files_urls){
		var deferred = Q.defer();
		deferred.resolve({files_urls: files_urls, path: path});
		return deferred.promise;
	});
}

var processFile = function (path, file, index, totalFiles) {
	var deferred = Q.defer();
	fs.readFile(path + file, function (err, data) {
	  if (err) {
	  	deferred.reject(err);
	  }
	  else {
	  	var bucketFilePath = path.split('/')[2]+'/';
	  	var fileName = totalFiles > 1 ? file.substring(0, file.lastIndexOf("-")) : path.basename(file).split(".")[0];
	  	var bucketFileName = bucketFilePath+fileName +'_thumb_'+index+'.png';
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
	      // fs.unlinkSync('./tmp/'+params['path']);
	      deferred.resolve(params['key']);
	    }
	  });
	});
	return deferred.promise;
}