const Schema = require('./credentialschema');
const CredDef = require('../models/credentialdef');

const indy = require('indy-sdk');
const wrap = require('../asyncwrap').wrap;
const pool = require('../pool');
const APIResult = require('../api-result');

module.exports = {

  create: wrap(async (req, res, next) => {
    let [credDefId, response] = await module.exports.createAndSendCredDefToLedger(req);
    let credDef = new CredDef({wallet:req.wallet.id, credDefId: credDefId, owner:req.user});
    if (response['op'] == 'REPLY') {
      credDef.set({data: response['result']});
      await credDef.save();
      next(new APIResult(200, credDefId));
    } else {
      next(new APIResult(400, response['reason']));
    }
  }),

  retrieve: wrap(async (req, res, next) => {
    const credDefId = req.params.creddef ? req.params.creddef : req.body.creddef;
    let [_, credDef] = await module.exports.getCredDefFromLedger(req, credDefId);
    next(new APIResult(200, credDef));
  }),

  list: wrap(async (req,res,next) => {
      log.debug('walletController list');
      const w = await CredDef.find({owner: req.user}).exec();
      next(new APIResult(200, w));

  }),

  getCredDefFromLedger: wrap(async (req, credDefId) =>  {
    const submitterDid = req.wallet.issuerDid ? req.wallet.issuerDid : req.wallet.createDid();
    let request = await indy.buildGetCredDefRequest(submitterDid,credDefId);
    let response = await indy.submitRequest(pool.handle,request);
    return await indy.parseGetCredDefResponse(response);
  }),

  getCredDefFromLocal: wrap(async (credDefId) => {
    let credDef =await CredDef.findOne({credDefId:credDefId});
    return credDef.data;
  }),

  createAndSendCredDefToLedger: wrap(async (req) => {
    let [,schema] = await Schema.getSchemaFromLedger(req);
    const support_revocation= req.body.supportRevocation ? { support_revocation: req.body.supportRevocation} : {support_revocation: false};
    let [credDefId, credDef ] = await indy.issuerCreateAndStoreCredentialDef(req.wallet.handle,req.wallet.issuerDid,schema,'TAG1','CL', support_revocation);
    let credDefRequest = await indy.buildCredDefRequest(req.wallet.issuerDid, credDef);
    let response = await indy.signAndSubmitRequest(pool.handle,req.wallet.handle,req.wallet.issuerDid,credDefRequest);
    return [credDefId, response]
  })
};
