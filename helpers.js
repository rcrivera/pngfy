var fs = require('fs');
var aws = require('aws-sdk');
var path = require('path');

aws.config.update({
	accessKeyId: process.env.PNGFY_AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.PNGFY_AWS_SECRET_ACCESS_KEY
});

var s3bucket = new aws.S3({params: {Bucket: process.env.PNGFY_AWS_BUCKET}});

module.exports = {
	convertToPng: function(file){
		// Note: file names should not have spaces
		var fileName = path.basename(file).split(".")[0];

		var convertCommand = "convert " + file + " tmp/"+ fileName + ".png"

		var convertExec = require('child_process').exec, child;

		child = convertExec(convertCommand,
		  function (error, stdout, stderr) {
		    console.log('stdout: ' + stdout);
		    console.log('stderr: ' + stderr);
		    if (error !== null) {
		      console.log('exec error: ' + error);
		    }
		    var filesToUpload = fs.readdirSync('./tmp').filter(filterFiles);
		    var totalFiles = filesToUpload.length;
				for (var index in filesToUpload) {
					processFile(filesToUpload[index], index, totalFiles);
				}
			}
		);
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
				});  
	    }
		});
  }
};

var filterFiles = function (file){
	if (path.extname(file) == '.png') return file;
} 

var processFile = function (file, index, totalFiles) {
	fs.readFile('./tmp/'+ file, function (err, data) {
	  if (err) { throw err; }

	  fileName = totalFiles > 1 ? file.substring(0, file.lastIndexOf("-")) : path.basename(file).split(".")[0];
	  bucketFileName = fileName +'_thumb_'+index+'.png';

	  var base64data = new Buffer(data, 'binary');

	  uploadFile(bucketFileName, base64data, file);
	});
}

var uploadFile = function (key, data, file){
	s3bucket.createBucket(function() {
	  var params = {Key: key, Body: data};
	  s3bucket.upload(params, function(err, data) {
	    if (err) {
	      console.log("Error uploading data: ", err);
	    } else {
	      console.log("Successfully uploaded " + key);
	      fs.unlinkSync('./tmp/'+file);
	    }
	  });
	});
}