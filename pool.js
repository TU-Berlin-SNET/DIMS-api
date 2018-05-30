/**
 * IDChain Agent REST API
 * Pool Ledger Representation
 */

const util = require('util');
const indy = require('indy-sdk');
const log = require('./log').log;

/**
 * Pool Representation
 */
class PoolLedger {
  /**
   * @param {String} name pool name
   * @param {Object} config config object
   */
  constructor(name, config) {
    this.name = name;
    this.config = config;
    this.handle = -1;
  }

  /**
   * Create Pool Ledger Config
   */
  async createConfig() {
    log.info('Creating pool ledger config %s with %s',
      this.name, util.inspect(this.config));
    await indy.createPoolLedgerConfig(this.name, this.config);
  }

  /**
   * Open Ledger connection
   */
  async openLedger() {
    log.info('providing pool handle for pool_name %s', process.env.POOL_NAME);
    this.handle = await indy.openPoolLedger(process.env.POOL_NAME);
    log.info('connection to pool ledger established');
  }
}

const poolLedger = new PoolLedger(process.env.POOL_NAME,
  {genesis_txn: `${__dirname}/${process.env.GENESIS_TXN}`});

module.exports = poolLedger;
