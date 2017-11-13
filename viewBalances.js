var level = require('level');


var db = level('your_database');
db.createReadStream()
	.on('data', function(data) {
		console.log(data.key, '=', data.value)
	})
	.on('error', function(err) {
		console.log('Oh my!', err)
	})
	.on('close', function() {
		console.log('Stream closed')
	})
	.on('end', function() {
		console.log('Stream ended')
	});
