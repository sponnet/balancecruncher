# balanceCruncher

BalanceCruncher gets a list of MEW ERC-20 addresses , reads all transactions on it - and reads all Transfer events.

Syncs all balances in a dedicated LevelDB database.

```node balanceCruncher.js```

# balanceServer

```node balanceServer.js```

BalanceServer serves the ERC-20 balances of any address.


