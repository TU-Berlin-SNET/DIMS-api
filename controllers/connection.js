/**
 * IDChain Agent REST API
 * ConnectionOffer and Connection Controller
 */

const indy = require('indy-sdk');

const wrap = require('../asyncwrap').wrap;
const log = require('../log').log;
const pool = require('../pool');
const APIResult = require('../api-result');
const ConnectionOffer = require('../models/connectionoffer');

module.exports = {

  create: wrap(async (req, res, next) => {
    log.debug('connection controller create');
    const [fromToDid, fromToKey] = await req.wallet.createDid();
    log.info('fromToDid: %s, fromToKey: %s', fromToDid, fromToKey);
    await indy.setEndpointForDid(req.wallet.handle, fromToDid,
      process.env.APP_ENDPOINT, fromToKey);
    const nymRequest = await indy.buildNymRequest(
      req.wallet.issuerDid, fromToDid, fromToKey);
    log.info('nymRequest: %s', nymRequest);
    const nymResult = await indy.signAndSubmitRequest(
      pool.handle, req.wallet.handle, req.wallet.issuerDid, nymRequest);
    log.info('nymResult: %s', nymResult);
    let connectionOffer = new ConnectionOffer({
      issuerWallet: req.wallet,
      issuerDid: fromToDid,
    });
    log.info('connectionoffer: %s', connectionOffer);
    connectionOffer = await connectionOffer.save();
    next(new APIResult(200, {
      did: connectionOffer.issuerDid,
      nonce: connectionOffer.nonce,
    }));
  }),

};
