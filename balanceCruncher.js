var level = require('level');
const request = require('request');
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:8546'));
const minimeContract = require('./contracts/miniMeToken.json');
const queue = require('async/queue');

var db = level('your_database');

request('https://raw.githubusercontent.com/kvhnuke/etherwallet/mercury/app/scripts/tokens/ethTokens.json',
	(error, response, body) => {

		let tokens = JSON.parse(body);

		console.log('tokens.length', tokens.length);

		var q = queue(function(task, callback) {
			console.log(task.tokenIndex, '**** Scanning token', task.tokenAddress);
			scanToken(task.tokenAddress, task.fromBlock, task.toBlock).then(() => {
				callback();
			});
		}, 2);


		web3.eth.getBlockNumber().then((b) => {
			for (let i = 0; i < tokens.length; i++) {
				q.push({
					tokenIndex: i + '/' + tokens.length,
					tokenAddress: tokens[i].address,
					fromBlock: 327222,
					toBlock: b
				}, function() {
					console.log('Scanned token... ****');
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


		scanrange(tokenContract, fromBlock, toBlock).then(() => {
			console.log('HODLERS');

			let promisesList = [];
			let sum = new web3.utils.BN();

			for (var key in tokenhodlers[tokenContract._address].hodlers) {
				// skip loop if the property is from prototype
				if (!tokenhodlers[tokenContract._address].hodlers.hasOwnProperty(key)) continue;

				let address = key;

				promisesList.push(tokenContract.methods.balanceOf(address).call().then((b) => {
					//console.log('HODLER', address, '=', typeof b);
					sum = sum.add(new web3.utils.BN(b));

					return ({
						key: (tokenContract._address + ':' + address).toLowerCase(),
						value: b,
						type: 'put'
					})
				}));
			}

			Promise.all(promisesList).then((r) => {
				console.log('batch=', r);

				db.batch(r, () => {
					console.log('balances saved in DB ');
				});

				console.log('ALL DONE', sum.toString(10));
				tokenContract.methods.totalSupply().call().then((total) => {
					console.log('total supply', total);
				});
			})
			console.timeEnd(tokenContract._address);
			resolve();
		});
	});

}


var tokenhodlers = {};

function scanrange(tokenContract, startBlock, endBlock) {


	let origins = new Promise((resolve, reject) => {

		web3.eth.getPastLogs({
			fromBlock: web3.utils.toHex(new web3.utils.BN(startBlock)),
			toBlock: web3.utils.toHex(new web3.utils.BN(startBlock + 1000)),
			address: tokenContract._address,
		}).then((a) => {
			for (let i = 0; i < a.length; i++) {
				//console.log(a[i]);
				//console.log('rambon tx coming from', a[i].address);
				tokenhodlers[tokenContract._address].hodlers[a[i].address] = true;
			}
			resolve();
		}).catch(() => {
			reject();
		});
	});

	let transfers = new Promise((resolve, reject) => {

		//console.log('scan range', startBlock, endBlock);

		tokenContract.getPastEvents('Transfer', {

			fromBlock: web3.utils.toHex(new web3.utils.BN(startBlock)),
			toBlock: web3.utils.toHex(new web3.utils.BN(startBlock + 1000)),
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
				scanrange(tokenContract, startBlock + 1000, endBlock).then(() => {
					resolve();
				});
			} else {
				console.log('DONE!');
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
