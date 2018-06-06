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
    const nymResult = await indy.signAndSubmitRequest(
      pool.handle, req.wallet.handle, req.wallet.issuerDid, nymRequest);
    if (['REJECT', 'REQNACK'].includes(nymResult['op'])) {
      next(new APIResult(400, {message: nymResult['response']}));
    }
    // const endpoint = {endpoint: {ha: process.env.APP_ENDPOINT, verkey: fromToKey}};
    // FIXME indy expects the endpoint to be a host but we expect messages to the endpoint
    // to arrive at /api/endpoint, how to work around that?
    const endpoint = {endpoint: {ha: req.body.endpoint || ENDPOINT}};
    const attribRequest = await indy.buildAttribRequest(
      fromToDid, fromToDid, null, endpoint, null);
    const attribResult = await indy.signAndSubmitRequest(
      pool.handle, req.wallet.handle, fromToDid, attribRequest);
    if (['REJECT', 'REQNACK'].includes(attribResult['op'])) {
      next(new APIResult(400, {message: attribResult['response']}));
    }
    let doc = {issuerWallet: req.wallet, issuerDid: fromToDid};
    if (req.body.role) doc.role = req.body.role;
    let connectionOffer = new ConnectionOffer(doc);
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
    const fromToKey = await indy.keyForDid(pool.handle, req.wallet.handle,
      connOffer.did);
    // TODO figure out a better way to handle issuerDid creation/saving
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
    const sign = await indy.cryptoSign(req.wallet.handle, toFromKey, connResponse);
    const [recipient] = await indy.getEndpointForDid(
      req.wallet.handle, pool.handle, connOffer.did);
    const payload = {
      type: 'anon',
      target: 'accept_connection',
      ref: connOffer.nonce,
      signature: sign.toString('base64'),
      message: anoncryptConnRes.toString('base64'),
    };
    const agentResult = await agent
      .post(`http://${recipient}/api/endpoint`)
      .type('application/json')
      .send(payload);
    if (agentResult.status !== 200) {
      return next(new APIResult(agentResult.status, {message: agentResult.body}));
    }
    await indy.storeTheirDid(req.wallet.handle, {
      did: connOffer.did,
      verkey: fromToKey,
    });
    await indy.setEndpointForDid(req.wallet.handle, connOffer.did,
      recipient, fromToKey);
    const endpoint = {endpoint: {ha: req.body.endpoint || ENDPOINT}};
    const attribRequest = await indy.buildAttribRequest(
      toFromDid, toFromDid, null, endpoint, null);
    const attribResult = await indy.signAndSubmitRequest(
      pool.handle, req.wallet.handle, toFromDid, attribRequest);
    if (['REJECT', 'REQNACK'].includes(attribResult['op'])) {
      next(new APIResult(400, {message: attribResult['response']}));
    }
    await indy.createPairwise(req.wallet.handle, connOffer.did, toFromDid);
    next(new APIResult(200, {connectionDid: toFromDid}));
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
    await indy.createPairwise(req.wallet.handle, connRes.did, connOffer.issuerDid);
    log.debug('created pairwise');
    await connOffer.remove();
    next(new APIResult(200, {message: 'Success'}));
  }),

};
