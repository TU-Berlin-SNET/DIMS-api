
const Schema = require('../models/indyschema');
const indy = require('indy-sdk');
const wrap = require('../asyncwrap').wrap;
const pool = require('../pool');
const APIResult = require('../api-result');



module.exports = {

  create: wrap(async (req, res, next) => {
    let  indySchema = new Schema({name: req.body.name, attrNames: req.body.attrNames, version : req.body.version, wallet:req.body.wallet});
    let [id, schema] = await indy.issuerCreateSchema(req.wallet.issuerDid, indySchema.name,indySchema.version, indySchema.attrNames);
    const request = await indy.buildSchemaRequest(req.wallet.issuerDid, schema);
    const requestResult = await indy.signAndSubmitRequest(pool.handle, req.wallet.handle, req.wallet.issuerDid, request);
    if(requestResult['op']=='REJECT'){
      next(new APIResult(400,requestResult['reason']));
    }else {
      indySchema.set({data:requestResult['result'], schemaId: id});
      indySchema = await indySchema.save();
      next(new APIResult(201,indySchema));
    }
  }),

  retrieve: wrap(async (req, res, next) => {
    const submitterDid = req.wallet.issuerDid ? req.wallet.issuerDid : req.wallet.createDid();
    let request = await indy.buildGetSchemaRequest(submitterDid,req.params.schema);
    let response = await indy.submitRequest(pool.handle,request);
    let parseResponse = await indy.parseGetSchemaResponse(response);

    next(new APIResult(200,parseResponse));
  }),

  list: wrap(async (req,res,next) =>{
    const s = await Schema.find({}).exec();
    next(new APIResult(200, s));
  })
};
