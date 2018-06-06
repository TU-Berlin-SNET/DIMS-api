/**
 * IDChain Agent REST API
 * Pool Ledger Representation
 */

const util = require('util');
const indy = require('indy-sdk');
const APIResult = require('./api-result');
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

  /**
   * Create, sign, and submit nym request to ledger.
   * @param {any} walletHandle
   * @param {any} submitterDid
   * @param {any} targetDid
   * @param {any} verkey
   * @param {any} alias
   * @param {any} role
   * @return {Object} IndyResponse
   * @throws APIResult on error
   */
  async nymRequest(walletHandle, submitterDid, targetDid, verkey, alias, role) {
    return await this._request(indy.buildNymRequest, indy.signAndSubmitRequest,
      [submitterDid, targetDid, verkey, alias, role],
      [this.handle, walletHandle, submitterDid]);
  }

  /**
   * Create, sign, and submit attrib request to ledger.
   * @param {Number} walletHandle
   * @param {String} submitterDid
   * @param {String} targetDid
   * @param {String} hash (Optional) Hash of attribute data
   * @param {Json} raw (Optional) Json, where key is attribute name and value is attribute value
   * @param {String} enc (Optional) Encrypted attribute data
   * @return {Object} IndyResponse
   * @throws APIResult on error
   */
  async attribRequest(walletHandle, submitterDid, targetDid, hash, raw, enc) {
    return await this._request(indy.buildAttribRequest, indy.signAndSubmitRequest,
      [submitterDid, targetDid, hash, raw, enc],
      [this.handle, walletHandle, submitterDid]);
  }

  /**
   * Build and submit request to ledger.
   * @param {Function} buildFn request build function
   * @param {Function} submitFn request submit function
   * @param {Any[]} buildOpts build function arguments
   * @param {Any[]} submitOpts submit function arguments
   * @return {Object}
   * @throws APIResult on error
   */
  async _request(buildFn, submitFn, buildOpts, submitOpts) {
    log.debug('pool_request; buildFn %s, requestFn %s, buildOpts %j, submitOpts %j',
      buildFn.name, submitFn.name, buildOpts, submitOpts);
    const request = await buildFn(...buildOpts);
    log.debug('request %j', request);
    const result = await submitFn(...submitOpts, request);
    log.debug('result %j', result);
    if (['REJECT', 'REQNACK'].includes(result['op'])) {
      throw new APIResult(400, result['reason']);
    }
    return result;
  }
}

const poolLedger = new PoolLedger(process.env.POOL_NAME,
  {genesis_txn: `${__dirname}/${process.env.GENESIS_TXN}`});

module.exports = poolLedger;
