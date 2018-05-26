
const Schema = require('../models/indyschema');
const Wallet = require('../models/wallet');

const indy = require('indy-sdk');
//const wP = require('../middleware/walletProvider');
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

    /*
    async def get_schema(pool_handle, _did, schema_id):
    get_schema_request = await ledger.build_get_schema_request(_did, schema_id)
    get_schema_response = await ledger.submit_request(pool_handle, get_schema_request)
    return await ledger.parse_get_schema_response(get_schema_response)
    */
    next();
  })


};


/*
listAllWalletsByOwner: async (req, res, next) => {
  console.log("HelloWallets")
  let w = await Wallet.find({owner: req.user});
  return res.status(200).send(w);
},*/
