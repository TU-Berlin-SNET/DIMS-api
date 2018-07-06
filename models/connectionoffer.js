/**
 * IDChain Agent REST API
 * Connection Offer Model
 */

const Mongoose = require('../db');
const nonce = require('../nonce');

const schema = new Mongoose.Schema({
  created: {
    type: Date,
    default: Date.now,
  },
  issuerWallet: {
    type: String,
    required: true,
    ref: 'Wallet',
  },
  ownDid: {
    type: String,
    required: true,
  },
  nonce: {
    type: String,
    required: true,
    index: true,
    default: nonce.uuidv4hex,
  },
  role: {
    type: String,
    required: true,
    default: 'NONE',
    enum: ['NONE', 'TRUSTEE', 'STEWARD', 'TRUST_ANCHOR'],
  },
});

module.exports = Mongoose.model('ConnectionOffer', schema);
