/**
 * IDChain Agent REST API
 * Wallet Model
 */

const indy = require('indy-sdk');
const uuidv4 = require('uuid/v4');
const log = require('../log').log;
const Mongoose = require('../db');
const ConnectionOffer = require('./connectionoffer');
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
  seed: {
    type: String,
    required: false,
  },
  issuerDid: {
    type: String,
    required: false,
  },
});

schema.virtual('handle')
  .get(function() {
    return this.__handle || -1;
  })
  .set(function(value) {
    this.__handle = value;
  });

schema.method('open', async function() {
  log.debug('wallet model open');
  if (this.handle === -1) {
    this.handle = await indy.openWallet(this._id, this.config, this.credentials);
  }
  return this.handle;
});

schema.method('close', async function() {
  log.debug('wallet model close');
  if (this.handle !== -1) await indy.closeWallet(this.handle);
});

schema.method('createDid', async function() {
  log.debug('wallet model createDid');
  // TEST ME this seems to create the same did every time,
  // maybe use seed only once (for issuerDid)
  const didJSON = (this.seed) ? {seed: this.seed} : {};
  return indy.createAndStoreMyDid(this.handle, didJSON);
});

schema.pre('remove', async function() {
  log.debug('wallet model pre-remove');
  await ConnectionOffer.remove({issuerWallet: this}).exec();
  await indy.deleteWallet(this._id, this.credentials);
});

module.exports = Mongoose.model('Wallet', schema);
