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
    const nymRequest = await indy.buildNymRequest(
      req.wallet.issuerDid, fromToDid, fromToKey);
    log.debug(nymRequest);
    const nymResult = await indy.signAndSubmitRequest(
      pool.handle, req.wallet.handle, req.wallet.issuerDid, nymRequest);
    log.debug(nymResult);
    // const endpoint = {endpoint: {ha: process.env.APP_ENDPOINT, verkey: fromToKey}};
    // FIXME indy expects the endpoint to be a host but we expect messages to the endpoint
    // to arrive at /api/endpoint, how to work around that?
    const endpoint = {endpoint: {ha: req.body.endpoint || ENDPOINT}};
    const attribRequest = await indy.buildAttribRequest(
      fromToDid, fromToDid, null, endpoint, null);
    log.debug(attribRequest);
    const attribResult = await indy.signAndSubmitRequest(
      pool.handle, req.wallet.handle, fromToDid, attribRequest);
    log.debug('attribResult');
    log.debug(attribResult);
    let doc = {issuerWallet: req.wallet, issuerDid: fromToDid};
    if (req.body.role) doc.role = req.body.role;
    let connectionOffer = new ConnectionOffer(doc);
    log.debug(connectionOffer);
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
    log.debug(connOffer);
    const [toFromDid, toFromKey] = await req.wallet.createDid();
    log.debug('%s\n%s', toFromDid, toFromKey);
    await indy.setEndpointForDid(req.wallet.handle, toFromDid,
      req.body.endpoint || ENDPOINT, toFromKey);
    log.debug('endpoint for did is set (locally)');
    const fromToKey = await indy.keyForDid(pool.handle, req.wallet.handle,
      connOffer.did);
    log.debug(fromToKey);
    if (connOffer.role !== 'NONE') {
      req.wallet.issuerDid = toFromDid;
      await req.wallet.save();
    }
    const connResponse = Buffer.from(JSON.stringify({
      did: toFromDid,
      verkey: toFromKey,
      nonce: connOffer.nonce,
    }), 'utf-8');
    const anoncryptConnRes = await indy.cryptoAnonCrypt(fromToKey, connResponse);
    log.debug('anoncrypted conn res');
    const sign = await indy.cryptoSign(req.wallet.handle, toFromKey, connResponse);
    log.debug('message signature created');
    const [recipient, endpointKey] = await indy.getEndpointForDid(
      req.wallet.handle, pool.handle, connOffer.did);
    log.debug(recipient);
    log.debug(endpointKey);
    const payload = {
      type: 'anon',
      target: 'accept_connection',
      ref: connOffer.nonce,
      signature: sign.toString('base64'),
      message: anoncryptConnRes.toString('base64'),
    };
    log.debug(payload);
    await agent
      .post(`http://${recipient}/api/endpoint`)
      .type('application/json')
      .send(payload);
    log.debug('endpoint request successful');
    await indy.storeTheirDid(req.wallet.handle, {
      did: connOffer.did,
      verkey: fromToKey,
    });
    log.debug('stored their did');
    await indy.setEndpointForDid(req.wallet.handle, connOffer.did,
      recipient, fromToKey);
    log.debug('set endpoint for their did successful locally');
    const endpoint = {endpoint: {ha: req.body.endpoint || ENDPOINT}};
    log.debug('setting own endpoint on ledger with attribRequest');
    // ToDo This does not seem right?? toFrom, toFromDid? Documentation states submitterDid and TargetDid
    const attribRequest = await indy.buildAttribRequest(
      toFromDid, toFromDid, null, endpoint, null);
    log.debug('attribRequest');
    log.debug(attribRequest);
    const attribResult = await indy.signAndSubmitRequest(
      pool.handle, req.wallet.handle, toFromDid, attribRequest);
    log.debug('attribResult');
    log.debug(attribResult);
    next(new APIResult(200, {connectionDid:toFromDid}));
  }),

  endpoint: wrap(async (req, res, next) => {
    log.debug('connection controller endpoint');
    const type = req.body.type;
    const target = req.body.target;
    const nonce = req.body.ref;
    const signature = req.body.signature;
    const message = req.body.message;
    log.debug('%s\n%s\n%s\n%s\n%s\n', type, target, nonce, signature, message);
    if (target !== 'accept_connection') {
      return next(new APIResult(501, {message: 'Not yet implemented'}));
    }
    const connOffer = await ConnectionOffer.findOne({nonce: nonce}).exec();
    if (!connOffer) {
      return next(new APIResult(404, {message: 'Unknown nonce'}));
    }
    log.debug(connOffer);
    req.wallet = await Wallet.findOne({_id: connOffer.issuerWallet}).exec();
    await req.wallet.open();
    log.debug(req.wallet.handle);
    const fromToKey = await indy.keyForLocalDid(
        req.wallet.handle, connOffer.issuerDid);
    log.debug('keyForDid: %s', fromToKey);
    const connResponseBuf = await indy.cryptoAnonDecrypt(
      req.wallet.handle, fromToKey, Buffer.from(message, 'base64'));
    const connRes = JSON.parse(connResponseBuf.toString('utf-8'));
    const signatureBuf = Buffer.from(signature, 'base64');
    log.debug('connRes %j', connRes);
    log.debug('connRes verkey %s', connRes.verkey);
    const signMatch = await indy.cryptoVerify(
      connRes.verkey, connResponseBuf, signatureBuf);
    log.debug('signature match %s', signMatch);
    if (!signMatch) {
      return next(new APIResult(400, {message: 'Signature mismatch'}));
    }
    const role = (connOffer.role === 'NONE') ? null : connOffer.role;
    const nymRequest = await indy.buildNymRequest(
      req.wallet.issuerDid, connRes.did, connRes.verkey, null, role);
    log.debug('nym request created');
    log.debug(nymRequest);
    const nymResult = await indy.signAndSubmitRequest(
      pool.handle, req.wallet.handle, req.wallet.issuerDid, nymRequest);
    log.debug('nym result received');
    log.debug(nymResult);
    await indy.storeTheirDid(req.wallet.handle, {
      did: connRes.did,
      verkey: connRes.verkey,
    });
    log.debug('stored their did');
    await connOffer.remove();
    next(new APIResult(200, {message: 'Success'}));
  }),

};
