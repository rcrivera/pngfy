var Fs = require('fs');
var Aws = require('aws-sdk');
var Path = require('path');
var Q = require('q');
var Rimraf = require('rimraf');
var host = 'http://localhost:8000/';
var thumbsPath = host + 'thumbs/';

Aws.config.update({
	accessKeyId: process.env.PNGFY_AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.PNGFY_AWS_SECRET_ACCESS_KEY
});

var s3bucket = new Aws.S3({params: {Bucket: process.env.PNGFY_AWS_BUCKET}});

module.exports = {
	convertToPng: function(file){
		var deferred = Q.defer();
		// Creates name for a temporary directory i.e. ./tmp/filename-1421207507
		var dir = generateDirName(file);

		create_tmp_directory(dir, file)
		.then(convertPdfToPng)
		.then(getConvertedFiles)
	  .then(uploadFiles)
	  .then(destroyTmpDirectory)
	  .then(
	  	function (filesUrls){
		  	var response = {name: dir.split("/")[2], urls: filesUrls};
	  		deferred.resolve(response);
  		},
  		function(err){
  			deferred.reject({error:'Invalid request'});
  		}
  	);

		return deferred.promise;
	},

  getKey: function(thumbName, page){
  	var deferred = Q.defer();
  	if (page) {
  		var thumb = thumbName + '/' + page;
  		s3bucket.getObject({Key: thumb}, function(err, data){
  			if (err) {
		    	console.error(err);
		    	deferred.reject(err);
		    }
		    else {
    			deferred.resolve(data.Body);
		    }
			});  
  	}
  	else{
  		s3bucket.listObjects({Marker: thumbName}, function (err, res) {
		    if (err) {
		    	console.error(err);
		    	deferred.reject(err);
		    }
		    else {
		    	var files = res['Contents'];
		    	var response = {name: thumbName, urls: []};
		    	files.map(function(file){
		    		response.urls.push(thumbsPath + file['Key']);
		    	});
		    	deferred.resolve(response);
		  	}
  		});
  	}
  	return deferred.promise;
  }
}

var generateDirName = function(file){
	var fileName = Path.basename(file).split(".")[0];
	var timestamp = Math.floor(new Date() / 1000); //Unix Timestamp
	return './tmp/'+fileName+'-'+timestamp+'/';
}

var create_tmp_directory = function (dirName, file){
	var deferred = Q.defer();
	Fs.mkdir(dirName, function(err) {
		if (err) {
			console.error(err);
			deferred.reject(err);
		}
		else {
			deferred.resolve({dirName: dirName, file: file});
		}
	});
	return deferred.promise;
}

var destroyTmpDirectory = function (params){
	var deferred = Q.defer();
	Rimraf(params['path'], function(err){
		if (err) {
			console.error(err);
			deferred.reject(err);
		}
		else {
			deferred.resolve(params['filesUrls']);
		}
	});
	return deferred.promise;
}

var convertPdfToPng = function (params){
	var deferred = Q.defer();
	var outputDirectory = params['dirName'];
	var file = params['file'];
	var outputFileName = outputDirectory.split("/")[2] + '.png';

	var convertCommand = "convert " + file + " " + outputDirectory + outputFileName;
	var convertExec = require('child_process').exec, child;

	child = convertExec(convertCommand,
	  function (err, stdout, stderr) {
	    if (err) {
	    	console.error(err)
	    	deferred.reject("File is no valid or doesn't exist");
	    }
	    else if (stderr){
	    	console.error(stderr)
	    	deferred.reject("File is no valid or doesn't exist");
	    }
	    else{
	    	deferred.resolve(outputDirectory);
	    }
		}
	);
	return deferred.promise;
}

var getConvertedFiles = function (dir){
	var deferred = Q.defer();
	Fs.readdir(dir, function (err, files){
		if (err) {
			console.error(err);
			deferred.reject(err);
		}
		else {
			deferred.resolve({files: files.filter(filterPng), dir: dir});
		}
	});
	return deferred.promise;
}

var filterPng = function (file){
	if (Path.extname(file) == '.png') return file;
}

var uploadFiles = function(params){
	var files = params['files'];
	var path = params['dir'];
	var totalFiles = files.length;	
	var promises = [];
	for (var index in files) {
		promises.push(processFile(path, files[index], index, totalFiles).then(uploadFile));
	}
	return Q.all(promises).then(function (filesUrls){
		var deferred = Q.defer();
		deferred.resolve({filesUrls: filesUrls, path: path});
		return deferred.promise;
	});
}

var processFile = function (pathToFile, file, index, totalFiles) {
	var deferred = Q.defer();
	Fs.readFile(pathToFile + file, function (err, data) {
	  if (err) {
	  	console.error(err);
	  	deferred.reject(err);
	  }
	  else {
	  	var bucketFilePath = pathToFile.split('/')[2]+'/';
	  	console.log(file);
	  	var fileName = totalFiles > 1 ? file.substring(0, file.lastIndexOf("-")) : Path.basename(file).split(".")[0];
	  	var bucketFileName = bucketFilePath+fileName +'_thumb_'+index+'.png';
	  	var base64data = new Buffer(data, 'binary');
	  	deferred.resolve({key: bucketFileName, data: data, path: file});
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
	      console.error("Error uploading data: ", err);
	      deferred.reject(err);
	    } 
	    else {
	      console.log("Successfully uploaded " + params['key']);
	      deferred.resolve(thumbsPath + params['key']);
	    }
	  });
	});
	return deferred.promise;
}