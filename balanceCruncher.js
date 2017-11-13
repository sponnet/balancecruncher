var level = require('level');
const request = require('request');
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:8546'));
//const web3 = new Web3('http://localhost:8545');
const minimeContract = require('./contracts/miniMeToken.json');
const queue = require('async/queue');

var db = level('your_database');

request('https://raw.githubusercontent.com/kvhnuke/etherwallet/mercury/app/scripts/tokens/ethTokens.json',
	(error, response, body) => {

		let tokens = JSON.parse(body);

		console.log('tokens.length', tokens.length);

		var q = queue(function(task, callback) {
			console.log(task.tokenIndex, '**** Scanning token', task.tokenInfo.symbol,'at',task.tokenAddress);
			scanToken(task.tokenAddress, task.fromBlock, task.toBlock).then(() => {
				callback();
			});
		}, 2);


		web3.eth.getBlockNumber().then((b) => {



			for (let i = 0; i < tokens.length; i++) {


				db.get('startblock-' + tokens[i].address, function(err, value) {
					let fromBlock = 0;

					if (err) {
						console.log('No startblock found for token ', tokens[i].address);
					} else {
						fromBlock = parseInt(value);
					}
					console.log('Startblock for token ', tokens[i].address, '=', fromBlock);


					q.push({
						tokenIndex: i + '/' + tokens.length,
						tokenInfo: tokens[i],
						tokenAddress: tokens[i].address,
						fromBlock: fromBlock,
						toBlock: b
					}, function() {
						console.log(i + '/' + tokens.length, 'Scanned token', tokens[i].address);
					});
				});
			}
		});

	});

function scanToken(tokenaddress, fromBlock, toBlock) {

	return new Promise((resolve, reject) => {

		let tokenContract = new web3.eth.Contract(minimeContract.abi, tokenaddress);

		tokenhodlers[tokenContract._address] = {
			hodlers: {}
		};

		console.time(tokenContract._address);


		scanrange(tokenContract, fromBlock, toBlock, 0)
			.then(() => {
				//console.log('HODLERS');

				let promisesList = [];
				let sum = new web3.utils.BN();

				for (var key in tokenhodlers[tokenContract._address].hodlers) {
					// skip loop if the property is from prototype
					if (!tokenhodlers[tokenContract._address].hodlers.hasOwnProperty(key)) continue;

					let address = key;

					promisesList.push(tokenContract.methods.balanceOf(address).call()
						.then((b) => {
							//console.log('HODLER', address, '=', typeof b);
							sum = sum.add(new web3.utils.BN(b));

							return ({
								key: (tokenContract._address + ':' + address).toLowerCase(),
								value: b,
								type: 'put'
							})
						}).catch((e) => {
							console.log(new Error(e));
						}));
				}

				Promise.all(promisesList)
					.then((r) => {

						r.push({
							key: 'startblock-' + (tokenContract._address).toLowerCase(),
							value: toBlock.toString(),
							type: 'put'
						});

						console.log('batch=', r);
						console.log('token', tokenContract._address, 'lastblock=', toBlock);

						db.batch(r, () => {
							console.log(tokenContract._address, ':', r.length, 'balances saved in DB . lastBlock=', toBlock);
						});

						console.log('ALL DONE', sum.toString(10));
						tokenContract.methods.totalSupply().call().then((total) => {
							console.log('total supply', total);
						}).catch((e) => {
							console.log(new Error(e));
						});
					}).catch((e) => {
						console.log(new Error(e));
					});
				console.timeEnd(tokenContract._address);
				resolve();
			}).catch((e) => {
				console.log(new Error(e));
				resolve();
			});
	});

}

const scanRangeInBlocks = 1000;

var tokenhodlers = {};

function scanrange(tokenContract, startBlock, endBlock, retries) {
	return new Promise((resolve, reject) => {
		console.log(tokenContract.address,'scanning between',startBlock,'=>',endBlock);	
		scanrange_(tokenContract, startBlock, endBlock, retries)
			.then(() => {
				resolve();
			}).catch((e) => {
				if (retries > 10) {
					reject(new Error(e));
				} else {
					console.log(e);
					console.log('scanrange bailed out on', tokenContract.address, startBlock, endBlock, 'Retry in 10s. retries=', retries);
					setTimeout(function() {
						scanrange(tokenContract, startBlock, endBlock, retries + 1);
					}, 5 * 1000);
				}
			});
	});
}

function scanrange_(tokenContract, startBlock, endBlock, retries) {


	let origins = new Promise((resolve, reject) => {

		web3.eth.getPastLogs({
			fromBlock: web3.utils.toHex(new web3.utils.BN(startBlock)),
			toBlock: web3.utils.toHex(new web3.utils.BN(startBlock + scanRangeInBlocks)),
			address: tokenContract._address,
		}).then((a) => {
			for (let i = 0; i < a.length; i++) {
				tokenhodlers[tokenContract._address].hodlers[a[i].address] = true;
			}
			resolve();
		}).catch((e) => {
			console.log(new Error(e));
			// TODO -> if node crashes, it should retry...
			reject();
		});
	});

	let transfers = new Promise((resolve, reject) => {

		tokenContract.getPastEvents('Transfer', {

			fromBlock: web3.utils.toHex(new web3.utils.BN(startBlock)),
			toBlock: web3.utils.toHex(new web3.utils.BN(startBlock + scanRangeInBlocks)),
			//address: tokenContract._address,
		}).then((a) => {
			if (a.length > 0) {
				//				console.log(startBlock, 'Transfer event=', a.length);
				for (let i = 0; i < a.length; i++) {
					let event = a[i];
					tokenhodlers[tokenContract._address].hodlers[event.returnValues._from] = true;
					tokenhodlers[tokenContract._address].hodlers[event.returnValues._to] = true;
				}
			}
			if (startBlock < endBlock) {
				scanrange(tokenContract, startBlock + scanRangeInBlocks, endBlock, retries).then(() => {
					resolve();
				}).catch((e) => {
					reject(new Error(e));
				});
			} else {
				console.log('DONE!',startBlock,endBlock);
				resolve();

			}
		}).catch((e) => {
			reject(new Error(e));
		});
	});

	return Promise.all([transfers, origins]);
}


// db.batch([{
// 	key: 'spo::A::C::B',
// 	value: triple,
// 	type: 'put'
// }, {
// 	key: 'sop::A::B::C',
// 	value: triple,
// 	type: 'put'
// }, {
// 	key: 'ops::B::C::A',
// 	value: triple,
// 	type: 'put'
// }, {
// 	key: 'osp::B::A::C',
// 	value: triple,
// 	type: 'put'
// }, {
// 	key: 'pso::C::A::B',
// 	value: triple,
// 	type: 'put'
// }, {
// 	key: 'pos::C::B::A',
// 	value: triple,
// 	type: 'put'
// }], () => {
// 	console.log('ok');
// });
