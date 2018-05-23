/**
 * IDCHain Agent REST API
 * User Model
 */

const SALTROUNDS = parseInt(process.env.SALTROUNDS);
const bcrypt = require('bcrypt');
const Mongoose = require('../db');
const Wallet = require('./wallet');

const schema = new Mongoose.Schema({
  // TODO should we use email instead?
  username: {
    type: String,
    index: true,
    unique: true,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
});

schema.pre('save', async function() {
  this.password = await bcrypt.hash(this.password, SALTROUNDS);
});

schema.pre('remove', async () => {
  await Wallet.remove({owner: this._id});
});

module.exports = Mongoose.model('User', schema);
