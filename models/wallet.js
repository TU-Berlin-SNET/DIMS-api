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
const APIResult = require('../api-result');

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
  ownDid: {
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
  if (this.handle !== -1) {
    await indy.closeWallet(this.handle);
    this.handle = -1;
  }
});

schema.method('createDid', async function() {
  log.debug('wallet model createDid');
  return indy.createAndStoreMyDid(this.handle, {});
});

schema.method('cryptoSign', async function(signKey, messageBuf) {
  const signature = await indy.cryptoSign(this.handle, signKey, messageBuf);
  return signature.toString('base64');
});

schema.method('cryptoVerify', async function(signerVk, messageBuf, signBuf) {
  return await indy.cryptoVerify(signerVk, messageBuf, signBuf);
});

schema.method('signAndAnonCrypt', async function(signKey, anonCryptKey, messageJson) {
  const messageBuf = Buffer.from(JSON.stringify(messageJson), 'utf-8');
  const signature = await this.cryptoSign(signKey, messageBuf);
  const anonCryptedMessage = await indy.cryptoAnonCrypt(anonCryptKey, messageBuf);
  return [signature, anonCryptedMessage.toString('base64')];
});

schema.method('anonDecryptAndVerify', async function(recipientVk, messageString, signature) {
  const cryptMessageBuf = Buffer.from(messageString, 'base64');
  const messageBuf = await indy.cryptoAnonDecrypt(this.handle, recipientVk, cryptMessageBuf);
  const signBuf = Buffer.from(signature, 'base64');
  const connRes = JSON.parse(messageBuf.toString('utf-8'));
  if (!connRes.verkey) throw new APIResult(400, {message: 'missing signature'});
  const signValid = this.cryptoVerify(connRes.verkey, messageBuf, signBuf);
  if (!signValid) throw new APIResult(400, {message: 'signature mismatch'});
  return connRes;
});

schema.method('authCrypt', async function(senderVk, recipientVk, messageJson) {
  const messageBuf = Buffer.from(JSON.stringify(messageJson), 'utf-8');
  const authCryptedMessage = await indy.cryptoAuthCrypt(this.handle, senderVk, recipientVk, messageBuf);
  return authCryptedMessage.toString('base64');
});

schema.method('authDecrypt', async function(recipientVk, messageRaw) {
  const cryptBuf = Buffer.from(messageRaw, 'base64');
  const [senderVk, messageBuf] = await indy.cryptoAuthDecrypt(this.handle, recipientVk, cryptBuf);
  const messageJson = JSON.parse(messageBuf.toString('utf-8'));
  return [senderVk, messageJson];
});

schema.method('tryAuthDecrypt', async function(message) {
  const cryptBuf = Buffer.from(message, 'base64');
  const pairwises = await indy.listPairwise(this.handle);
  for (const pairwise of pairwises) {
    try {
    const recipientDid = pairwise['my_did'];
    const recipientVk = await indy.keyForLocalDid(this.handle, recipientDid);
    const [senderVk, messageBuf] = await indy.cryptoAuthDecrypt(this.handle, recipientVk, cryptBuf);
    const messageJson = JSON.parse(messageBuf.toString('utf-8'));
    return [recipientDid, recipientVk, senderVk, messageJson];
    } catch (err) {
      log.warn(err);
    }
  }
  throw new APIResult(400, {message: 'decryption failed, no fitting decryption key found'});
});

schema.method('getTheirDid', async function(wallet, myDid) {
  const listPairwise = await indy.listPairwise(wallet);
  const theirDid = listPairwise.filter((e) => e.my_did === myDid).pop().their_did;
  return theirDid;
});

schema.method('getMyPairwiseDid', async function(theirDid) {
  const pairwiseInfo = await indy.getPairwise(this.handle, theirDid);
  return pairwiseInfo['my_did'];
});

schema.method('toMinObject', function() {
  let m = {};
  m.id = this._id;
  m.created = this.created;
  m.owner = (typeof owner === 'object') ? this.owner._id.toString() : this.owner.toString();
  m.poolName = this.poolName;
  m.xtype = this.xtype;
  m.config = this.config;
  m.credentials = this.credentials;
  m.ownDid = this.ownDid;
  return m;
});

schema.pre('remove', async function() {
  log.debug('wallet model pre-remove');
  await this.close();
  await ConnectionOffer.remove({issuerWallet: this}).exec();
  await indy.deleteWallet(this._id, this.credentials);
});

module.exports = Mongoose.model('Wallet', schema);
