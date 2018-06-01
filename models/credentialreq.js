/**
 * IDCHain Agent REST API
 * Schema Model
 */

const Mongoose = require('../db');
const indy = require('indy-sdk');
const wrap = require('../asyncwrap').wrap;
const pool = require('../pool');
var Mixed = Mongoose.Schema.Types.Mixed;

const schema = new Mongoose.Schema({
  created: {
    type: Date,
    default: Date.now,
  },
  credDefId: String,
  credReqMetaData: Mixed,
  wallet:{
    type: String
  },
  data: Mixed
});





module.exports = Mongoose.model('CredentialRequest', schema);
