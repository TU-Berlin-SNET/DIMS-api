/**
 * IDChain Agent REST API
 * Pool Ledger Representation
 */

const PoolLedger = require('./lib/ledger');

const poolLedger = new PoolLedger(process.env.IDC_POOL_NAME, {
    genesis_txn: process.env.IDC_API_GENESIS_TXN
});

module.exports = poolLedger;
