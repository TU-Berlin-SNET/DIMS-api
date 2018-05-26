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
var Mixed = Mongoose.Schema.Types.Mixed;

const schema = new Mongoose.Schema({
  // TODO Check if extra id is needed on top of name
  // should name be primary key
  created: {
    type: Date,
    default: Date.now,
  },
  name: {
    type: String,
    required: true,
  },
  attrNames: {
    type: Array,
    required: true,
    default: null,
  },
  version: {
    type: String,
    required: true,
    default: null,
  },
  wallet:{
    type: String
  },
  schemaId: String,
  data: Mixed
});

schema.pre('save', async () =>{

});



module.exports = Mongoose.model('Schema', schema);
