const Schema = require('../models/indyschema');
const indy = require('indy-sdk');
const wrap = require('../asyncwrap').wrap;
const pool = require('../pool');
const APIResult = require('../api-result');

module.exports = {

  create: wrap(async (req, res, next) => {
    let [schemaId,indySchema,response] = await module.exports.createAndStoreSchemaToLedger(req);
    if(response['op']=='REJECT'){
      next(new APIResult(400,response['reason']));
    }else {
      indySchema.set({data:response['result'], schemaId: schemaId});
      indySchema = await indySchema.save();
      next(new APIResult(201,indySchema));
    }
  }),

  retrieve: wrap(async (req, res, next) => {
    let parsedResponse = await module.exports.getSchemaFromLedger(req);
    next(new APIResult(200,parsedResponse));
  }),

  list: wrap(async (req,res,next) =>{
    const s = await Schema.find({}).exec();
    next(new APIResult(200, s));
  }),

  getSchemaFromLedger: wrap(async(req) => {
    const submitterDid = req.wallet.issuerDid ? req.wallet.issuerDid : req.wallet.createDid();
    const schemaId = req.params.schema ? req.params.schema : req.body.schema;
    let request = await indy.buildGetSchemaRequest(submitterDid,schemaId);
    let response = await indy.submitRequest(pool.handle,request);
    return await indy.parseGetSchemaResponse(response);
  }),

  createAndStoreSchemaToLedger: wrap(async (req) =>{
    let  indySchema = new Schema({name: req.body.name, attrNames: req.body.attrNames, version : req.body.version, wallet:req.body.wallet});
    let [schemaId, schema] = await indy.issuerCreateSchema(req.wallet.issuerDid, indySchema.name,indySchema.version, indySchema.attrNames);
    const request = await indy.buildSchemaRequest(req.wallet.issuerDid, schema);
    let response = await indy.signAndSubmitRequest(pool.handle, req.wallet.handle, req.wallet.issuerDid, request);
    return [schemaId,indySchema,response];
  })

};

