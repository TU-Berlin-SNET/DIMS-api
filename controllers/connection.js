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
    /* log.debug('fromToDid: %s, fromToKey: %s', fromToDid, fromToKey);
    await indy.setEndpointForDid(req.wallet.handle, fromToDid,
      process.env.APP_ENDPOINT, fromToKey);
    const [recipient, endpointKey] = await indy.getEndpointForDid(
      req.wallet.handle, pool.handle, fromToDid);
    log.debug('endpoint %s and key %s', recipient, endpointKey);*/
    const nymRequest = await indy.buildNymRequest(
      req.wallet.issuerDid, fromToDid, fromToKey);
    log.debug(nymRequest);
    const nymResult = await indy.signAndSubmitRequest(
      pool.handle, req.wallet.handle, req.wallet.issuerDid, nymRequest);
    log.debug(nymResult);
    // const endpoint = {endpoint: {ha: process.env.APP_ENDPOINT, verkey: fromToKey}};
    const endpoint = {endpoint: {ha: '127.0.0.1:8000'}};
    const attribRequest = await indy.buildAttribRequest(
      fromToDid, fromToDid, null, endpoint, null);
    log.debug(attribRequest);
    const attribResult = await indy.signAndSubmitRequest(
      pool.handle, req.wallet.handle, fromToDid, attribRequest);
    log.debug('attribResult');
    log.debug(attribResult);
    let connectionOffer = new ConnectionOffer({
      issuerWallet: req.wallet,
      issuerDid: fromToDid,
    });
    log.debug(connectionOffer);
    connectionOffer = await connectionOffer.save();
    next(new APIResult(200, {
      did: connectionOffer.issuerDid,
      nonce: connectionOffer.nonce,
    }));
  }),

};
