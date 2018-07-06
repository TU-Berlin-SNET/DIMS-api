const Schema = require('../models/credentialschema');
const indy = require('indy-sdk');
const wrap = require('../asyncwrap').wrap;
const pool = require('../pool');
const APIResult = require('../api-result');

module.exports = {

  create: wrap(async (req, res, next) => {
    let [schemaId, credSchema, response] = await module.exports.createAndStoreSchemaToLedger(req);
    if (response['op'] === 'REJECT' || response['op'] === 'REQNACK') {
      next(new APIResult(400, response['reason']));
    } else {
      credSchema.set({data: response['result'], schemaId: schemaId});
      await credSchema.save();
      next(new APIResult(201, {schemaId: schemaId}));
    }
  }),

  retrieve: wrap(async (req, res, next) => {
    const submitterDid = req.wallet.ownDid;
    const schemaId = req.params.schema ? req.params.schema : req.body.schema;
    let parsedResponse = await Schema.getSchemaFromLedger(submitterDid,schemaId);
    next(new APIResult(200,parsedResponse));
  }),

  list: wrap(async (req,res,next) =>{
    const s = await Schema.find({}).exec();
    next(new APIResult(200, s));
  }),

  getSchemaFromLedger: wrap(async(submitterDid,schemaId) => {
    let request = await indy.buildGetSchemaRequest(submitterDid,schemaId);
    let response = await indy.submitRequest(pool.handle,request);
    return await indy.parseGetSchemaResponse(response);
  }),

  createAndStoreSchemaToLedger: wrap(async (req) => {
    let  credSchema = new Schema({name: req.body.name, attrNames: req.body.attrNames, version : req.body.version, wallet:req.wallet.id, owner:req.user});
    let [schemaId, schema] = await indy.issuerCreateSchema(req.wallet.ownDid, credSchema.name,credSchema.version, credSchema.attrNames);
    const request = await indy.buildSchemaRequest(req.wallet.ownDid, schema);
    let response = await indy.signAndSubmitRequest(pool.handle, req.wallet.handle, req.wallet.ownDid, request);
    return [schemaId,credSchema,response];
  })

};

