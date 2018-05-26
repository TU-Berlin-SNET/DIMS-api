/**
 * IDChain Agent REST API
 * Pool Ledger Representation
 */

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
    try {
      await indy.createPoolLedgerConfig(this.name, this.config);
    } catch (err) {
      log.warn(err);
    }
  }

  /**
   * Open Ledger connection
   */
  async openLedger() {
    log.info('providing pool handle for pool_name %s', process.env.POOL_NAME);
    this.handle = await indy.openPoolLedger(process.env.POOL_NAME);
  }
}

const poolLedger = new PoolLedger(process.env.POOL_NAME,
  {genesis_txn: `${__dirname}/${process.env.GENESIS_TXN}`});

module.exports = poolLedger;
