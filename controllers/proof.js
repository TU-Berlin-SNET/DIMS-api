
const indy = require('indy-sdk');
const wrap = require('../asyncwrap').wrap;
const pool = require('../pool');
const log = require('../log').log;
const APIResult = require('../api-result');
const ProofRequest = require('../models/proofreq');

module.exports = {

  // Called by Verifier
  createProofRequest: wrap(async (req, res, next) => {
    const recipientDid = req.body.recipient;
    const proofReqJson = req.body.proofRequest;
    const senderDid = await req.wallet.getMyPairwiseDid(recipientDid);
    const recipientVk = await indy.keyForDid(pool.handle, req.wallet.handle, recipientDid);
    const senderVk = await indy.keyForDid(pool.handle, req.wallet.handle, senderDid);
    let proofReq = new ProofRequest({
      wallet: req.wallet,
      recipient: recipientDid,
    });
    proofReq = await proofReq.save();
    proofReqJson['id'] = proofReq.id;
    proofReqJson['nonce'] = proofReq.nonce;
    proofReq.data = proofReqJson;
    await proofReq.save();
    const cryptProofReq = await req.wallet.authCrypt(senderVk, recipientVk, proofReq.data);
    res.set('location', `proofrequest/${proofReq.id}`);
    next(new APIResult(201, {encryptedProofRequest: cryptProofReq}));
  }),

  // Called by Verifier
  getProofRequest: wrap(async (req, res, next) => {
    // FIXME check ownership
    const proofReq = await ProofRequest.findById(req.params.proofReq);
    next(new APIResult(200, proofReq));
  }),

  // Called by IDHolder
  createProof: wrap(async (req, res, next) => {
    next(new APIResult(501, {message: 'not yet implemented'}));
  }),

};
