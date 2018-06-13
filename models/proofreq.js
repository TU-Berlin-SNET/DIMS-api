/**
 * IDChain Agent REST API
 * Proof Request Model
 */

const Mongoose = require('../db');
const nonce = require('../nonce');

const schema = new Mongoose.Schema({
  created: {
    type: Date,
    default: Date.now,
  },
  wallet: {
    type: String,
    required: true,
    ref: 'Wallet',
  },
  nonce: {
    type: String,
    index: true,
    default: nonce.uuidv4hex,
  },
  data: { },
});

module.exports = Mongoose.model('ProofRequest', schema);
