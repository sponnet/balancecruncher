const express = require('express');
var app = express();
const port = process.env.PORT || 3000;
var level = require('level');
const request = require('request');

var db = level('your_database');

request('https://raw.githubusercontent.com/kvhnuke/etherwallet/mercury/app/scripts/tokens/ethTokens.json',
	(error, response, body) => {

		let tokens = JSON.parse(body);


		// todoList Routes
		app.route('/balances/:address')
			.get(list_all_tasks);

		app.listen(port);

		console.log('Balance API server started on: ' + port);


		function list_all_tasks(req, res) {
			var startTime = Date.now();

			let promisesList = [];

			for (let i = 0; i < tokens.length; i++) {
				promisesList.push(new Promise((resolve, reject) => {
					let key = (tokens[i].address + ':' + req.params.address).toLowerCase();
					db.get(key, function(err, value) {
						if (err) {
							if (err.notFound) {
								// handle a 'NotFoundError' here
								return resolve();
							}
							// I/O or other error, pass it up the callback chain
							return reject();
						}

						resolve({
							token: tokens[i].address,
							balance: value
						});
					})
				}));
			}

			Promise.all(promisesList).then((result) => {

				let nonempty = result.reduce(function(a, b) {
					if (b) {
						return a.concat(b);

					} else {
						return a;
					}
				}, []);



				res.json({
					duration: Date.now() - startTime,
					address: req.params.address,
					balances: nonempty,
				});

			});

		};



	});
