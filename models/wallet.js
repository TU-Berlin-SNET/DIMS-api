/**
 * IDCHain Agent REST API
 * Wallet Model
 */

const indy = require('indy-sdk');
const uuidv4 = require('uuid/v4');
const Mongoose = require('../db');
const log = require('../log').log;
const ObjectId = Mongoose.Schema.Types.ObjectId;

const schema = new Mongoose.Schema({
  // TODO does this make sense or should we revert to ObjectId for _id
  // and use a separate name for the wallet?
  _id: {
    type: String,
    default: uuidv4,
  },
  created: {
    type: Date,
    default: Date.now,
  },
  owner: {
    type: ObjectId,
    required: true,
    ref: 'User',
  },
  poolName: {
    type: String,
    required: false,

  },
  xtype: {
    type: String,
    required: false,
    default: null,
  },
  config: {
    type: String,
    required: false,
    default: null,
  },
  credentials: {
    type: String,
    required: false,
    default: null,
  },
});

schema.pre('save', async function() {
  await indy.createWallet(
    this.poolName,
    this._id,
    this.xtype,
    this.config,
    this.credentials);
});

schema.pre('remove', async function() {
  // TODO cascade delete?
  try {
    await indy.deleteWallet(this.name, this.credentials);
  } catch (err) {
    log.warn(err);
  }
});

module.exports = Mongoose.model('Wallet', schema);
