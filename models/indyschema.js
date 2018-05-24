/**
 * IDCHain Agent REST API
 * Schema Model
 */

const indy = require('indy-sdk');
const uuidv4 = require('uuid/v4');
const Mongoose = require('../db');
const log = require('../log').log;
const ObjectId = Mongoose.Schema.Types.ObjectId;
const Wallet = require('../models/wallet');


const schema = new Mongoose.Schema({
  // TODO Check if extra id is needed on top of name
  // should name be primary key
  _id: {
    type: String,
    index:true
  },
  created: {
    type: Date,
    default: Date.now,
  },
  name: {
    type: String,
    required: true,
  },
  attrNames: {
    type: String,
    required: true,
    default: null,
  },
  version: {
    type: String,
    required: true,
    default: null,
  }
});

schema.pre('save', async () =>{
  const issuerDid = Wallet.find()
  const schema = await indy.issuerCreateSchema(issuerDid, name,version, attrNamesJson, next);

});



module.exports = Mongoose.model('Schema', schema);
