/**
 * IDChain Agent REST API
 * ConnectionOffer and Connection Controller
 */

const indy = require('indy-sdk');
const agent = require('superagent');

const wrap = require('../asyncwrap').wrap;
const log = require('../log').log;
const pool = require('../pool');
const APIResult = require('../api-result');
const Wallet = require('../models/wallet');
const ConnectionOffer = require('../models/connectionoffer');

const ENDPOINT = `${process.env.APP_HOST}:${process.env.APP_PORT}`;

module.exports = {

  create: wrap(async (req, res, next) => {
    log.debug('connection controller create');
    const [fromToDid, fromToKey] = await req.wallet.createDid();
    await pool.nymRequest(req.wallet.handle, req.wallet.issuerDid, fromToDid, fromToKey);
    await pool.attribRequest(req.wallet.handle, fromToDid, fromToDid, null,
      {endpoint: {ha: req.body.endpoint || ENDPOINT, verkey: fromToKey}}, null);
    let connectionOffer = new ConnectionOffer({
      issuerWallet: req.wallet,
      issuerDid: fromToDid,
      role: req.body.role || 'NONE',
    });
    connectionOffer = await connectionOffer.save();
    next(new APIResult(201, {
      did: connectionOffer.issuerDid,
      nonce: connectionOffer.nonce,
      role: connectionOffer.role,
    }));
  }),

  accept: wrap(async (req, res, next) => {
    log.debug('connection controller accept');
    const connOffer = req.body.connectionOffer;
    const [toFromDid, toFromKey] = await req.wallet.createDid();
    await indy.setEndpointForDid(req.wallet.handle, toFromDid,
      req.body.endpoint || ENDPOINT, toFromKey);
    const fromToKey = await indy.keyForDid(pool.handle, req.wallet.handle, connOffer.did);
    // TODO figure out a better way to handle issuerDid creation/saving
    if (connOffer.role !== 'NONE') {
      req.wallet.issuerDid = toFromDid;
      await req.wallet.save();
    }
    const [signature, anonCryptConnRes] = await req.wallet.signAndAnonCrypt(
      toFromKey, fromToKey, {
      did: toFromDid,
      verkey: toFromKey,
      nonce: connOffer.nonce,
    });
    const [recipient] = await indy.getEndpointForDid(req.wallet.handle, pool.handle, connOffer.did);
    const agentResult = await agent
      .post(`http://${recipient}/api/endpoint`)
      .type('application/json')
      .send({
        type: 'anon',
        target: 'accept_connection',
        ref: connOffer.nonce,
        signature: signature,
        message: anonCryptConnRes,
      });
    if (agentResult.status !== 200) {
      return next(new APIResult(agentResult.status, {message: agentResult.body}));
    }
    await indy.storeTheirDid(req.wallet.handle, {did: connOffer.did, verkey: fromToKey});
    await indy.setEndpointForDid(req.wallet.handle, connOffer.did, recipient, fromToKey);
    await pool.attribRequest(req.wallet.handle, toFromDid, toFromDid, null,
      {endpoint: {ha: req.body.endpoint || ENDPOINT}}, null);
    await indy.createPairwise(req.wallet.handle, connOffer.did, toFromDid);
    next(new APIResult(200, {
      myDid: toFromDid,
      theirDid: connOffer.did,
    }));
  }),

  endpoint: wrap(async (req, res, next) => {
    log.debug('connection controller endpoint');
    const type = req.body.type;
    const target = req.body.target;
    const nonce = req.body.ref;
    const signature = req.body.signature;
    const message = req.body.message;
    if (type !== 'anon' || target !== 'accept_connection') {
      return next(new APIResult(501, {message: 'Not yet implemented'}));
    }
    const connOffer = await ConnectionOffer.findOne({nonce: nonce}).exec();
    if (!connOffer) {
      return next(new APIResult(404, {message: 'Unknown nonce'}));
    }
    // TODO interface with walletProvider here
    req.wallet = await Wallet.findOne({_id: connOffer.issuerWallet}).exec();
    await req.wallet.open();
    const fromToKey = await indy.keyForDid(pool.handle, req.wallet.handle, connOffer.issuerDid);
    const connRes = await req.wallet.anonDecryptAndVerify(fromToKey, message, signature);
    const role = (connOffer.role === 'NONE') ? null : connOffer.role;
    await pool.nymRequest(req.wallet.handle, req.wallet.issuerDid, connRes.did, connRes.verkey, null, role);
    await indy.storeTheirDid(req.wallet.handle, {did: connRes.did, verkey: connRes.verkey});
    await indy.createPairwise(req.wallet.handle, connRes.did, connOffer.issuerDid);
    await connOffer.remove();
    next(new APIResult(200, {message: 'Success'}));
  }),

};
