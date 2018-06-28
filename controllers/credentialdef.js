/**
 * IDChain Agent REST API
 * Credential Definition Controller
 */

const indy = require('indy-sdk');

const CredDef = require('../models/credentialdef');
const wrap = require('../asyncwrap').wrap;
const pool = require('../pool');
const APIResult = require('../api-result');

module.exports = {

  create: wrap(async (req, res, next) => {
    const submitterDid = req.wallet.ownDid;
    const schemaId = req.body.schemaId;
    const supportRevocation = req.body.supportRevocation || false;
    const [, schema] = await pool.getSchema(submitterDid, schemaId);
    const [credDefId, credDef] = await indy.issuerCreateAndStoreCredentialDef(
      req.wallet.handle, req.wallet.ownDid, schema, 'TAG1', 'CL',
      {'support_revocation': supportRevocation});
    const response = await pool.credDefRequest(req.wallet.handle, req.wallet.ownDid, credDef);
    const credDefDoc = await new CredDef({
      credDefId: credDefId,
      wallet: req.wallet.id,
      data: response['result'],
    }).save();
    next(new APIResult(201, {credDefId: credDefDoc.credDefId}));
  }),

  list: wrap(async (req, res, next) => {
      const w = await CredDef.find({wallet: req.wallet.id}).exec();
      next(new APIResult(200, w));
  }),

  retrieve: wrap(async (req, res, next) => {
    const credDefId = req.params.credDefId;
    const submitterDid = req.wallet.ownDid;
    const [, credDef] = await pool.getCredDef(submitterDid, credDefId);
    next(new APIResult(200, credDef));
  }),

};
