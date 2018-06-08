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
    const credDefId = req.params.credDefId ? req.params.credDefId: req.body.credDefId;
    const submittedDid = req.wallet.ownDid;
    let [_, credDef] = await module.exports.getCredDefFromLedger(submittedDid, credDefId);
    next(new APIResult(200, credDef));
  }),

  list: wrap(async (req,res,next) => {
      log.debug('walletController list');
      const w = await CredDef.find({owner: req.user}).exec();
      next(new APIResult(200, w));

  }),

  getCredDefFromLocal: wrap(async (credDefId) => {
    let credDef =await CredDef.findOne({credDefId:credDefId});
    return credDef.data;
  }),

  getCredDefFromLedger: wrap(async (submitterDid, credDefId) =>  {
    let request = await indy.buildGetCredDefRequest(submitterDid,credDefId);
    let response = await indy.submitRequest(pool.handle,request);
    return await indy.parseGetCredDefResponse(response);
  }),

  createAndSendCredDefToLedger: wrap(async (req) => {
    const submitterDid = req.wallet.ownDid;
    const schemaId = req.body.schema;
    let [,schema] = await Schema.getSchemaFromLedger(submitterDid,schemaId);
    const support_revocation= req.body.supportRevocation ? { support_revocation: req.body.supportRevocation} : {support_revocation: false};
    let [credDefId, credDef ] = await indy.issuerCreateAndStoreCredentialDef(req.wallet.handle,req.wallet.ownDid,schema,'TAG1','CL', support_revocation);
    let credDefRequest = await indy.buildCredDefRequest(req.wallet.ownDid, credDef);
    let response = await indy.signAndSubmitRequest(pool.handle,req.wallet.handle,req.wallet.ownDid,credDefRequest);
    return [credDefId, response]
  })
};
