const Schema = require('../controllers/indyschema');
const CredDef = require('../models/credentialdef');

const indy = require('indy-sdk');
const wrap = require('../asyncwrap').wrap;
const pool = require('../pool');
const APIResult = require('../api-result');

module.exports = {

  create: wrap(async (req, res, next) => {
    let [credDefId, response] = await module.exports.createAndSendCredDefToLedger(req);
    let credDef = new CredDef({wallet:req.body.wallet, credDefId: credDefId})
    if (response['op'] == 'REPLY') {
      credDef.set({data: response['result']});
      credDef = await credDef.save();
      next(new APIResult(200, credDef));
    } else {
      next(new APIResult(400, response['reason']));
    }
  }),

  retrieve: wrap(async (req, res, next) => {
    let parsedResponse = await module.exports.getCredDefFromLedger(req);
    next(new APIResult(200, parsedResponse));
  }),

  getCredDefFromLedger: async function (req)  {
    const submitterDid = req.wallet.issuerDid ? req.wallet.issuerDid : req.wallet.createDid();
    const credReqId = req.params.credreq ? req.params.credreq : req.body.credreq;
    let request = await indy.buildGetCredDefRequest(submitterDid,credReqId);
    let response = await indy.submitRequest(pool.handle,request);
    return await indy.parseGetCredDefResponse(response);
  },

  createAndSendCredDefToLedger: async function (req)  {
    let [,schema] = await Schema.getSchemaFromLedger(req);
    const support_revocation= req.body.supportRevocation ? { support_revocation: req.body.supportRevocation} : {support_revocation: false};
    let [credDefId, credDef ] = await indy.issuerCreateAndStoreCredentialDef(req.wallet.handle,req.wallet.issuerDid,schema,'TAG1','CL', support_revocation);
    let credDefRequest = await indy.buildCredDefRequest(req.wallet.issuerDid, credDef);
    let response = await indy.signAndSubmitRequest(pool.handle,req.wallet.handle,req.wallet.issuerDid,credDefRequest);
    return [credDefId, response]
  }
};
