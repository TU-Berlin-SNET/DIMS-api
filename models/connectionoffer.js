/**
 * IDChain Agent REST API
 * Connection Offer Model
 */

const uuidv4 = require('uuid/v4');
const Mongoose = require('../db');

/**
 * Generates a uuid v4 and converts it to hexadecimal representation
 * @return {String} uuidv4 in hex format
 */
function uuidv4hex() {
  // FIXME nonce is some long number instead of a short-ish string
  return Buffer.from(uuidv4(), 'utf-8').toString('hex');
}

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
  issuerDid: {
    type: String,
    required: true,
  },
  nonce: {
    type: String,
    required: true,
    default: uuidv4hex,
  },
});

module.exports = Mongoose.model('ConnectionOffer', schema);
