/**
 * IDChain Agent REST API
 * ConnectionOffer and Connection Controller
 */

const indy = require('indy-sdk');

const wrap = require('../asyncwrap');
const log = require('../log').log;
const Wallet = require('../models/wallet');
const ConnectionOffer = require('../models/connectionoffer');

module.exports = {

  create: wrap(async (req, res, next) => {
    const w = await Wallet.findOne({
      _id: req.body.wallet,
      owner: req.user,
    }).exec();
    if (!w) return next({status: 400, message: 'Wallet does not exist'});
    log.info(w);
    let poolHandle = -1;
    try {
      await w.open();
      log.info('Wallet Handle: ' + w.handle);
      const [fromToDid, fromToKey] = await w.createDid();
      log.info('fromToDid: %s, fromToKey: %s', fromToDid, fromToKey);
      await indy.setEndpointForDid(w.handle, fromToDid,
        process.env.APP_ENDPOINT, fromToKey);
      const nymRequest = await indy.buildNymRequest(
        w.issueDid, fromToDid, fromToKey);
      log.info('nymRequest: %s', nymRequest);
      poolHandle = await indy.openPoolLedger(process.env.POOL_NAME);
      const nymResult = await indy.signAndSubmitRequest(
        poolHandle, w.handle, w.issueDid, nymRequest);
      log.info('nymResult: %s', nymResult);
      let connectionOffer = new ConnectionOffer({
        issuerWallet: w,
        issuerDid: fromToDid,
      });
      log.info('connectionoffer: %s', connectionOffer);
      connectionOffer = await connectionOffer.save();
      return res.status(200).json({
          did: connectionOffer.issuerDid,
          nonce: connectionOffer.nonce,
        });
    } finally {
      await w.close();
      if (poolHandle !== -1) indy.closePoolLedger(poolHandle);
    }
  }),

};
