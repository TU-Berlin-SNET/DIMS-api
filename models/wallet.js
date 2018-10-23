/**
 * IDChain Agent REST API
 * Wallet Model
 */

const indy = require('indy-sdk');
const uuidv4 = require('uuid/v4');
const log = require('../log').log;
const Mongoose = require('../db');
const ObjectId = Mongoose.Schema.Types.ObjectId;
const APIResult = require('../api-result');

const schema = new Mongoose.Schema({
    _id: {
        type: String,
        default: uuidv4
    },
    created: {
        type: Date,
        default: Date.now
    },
    owner: {
        type: ObjectId,
        required: true,
        ref: 'User'
    },
    users: [
        {
            type: ObjectId,
            ref: 'User',
            default: []
        }
    ],
    credentials: {
        key: {
            type: String,
            required: true,
            default: null
        }
    },
    // it doesn't make sense for multiple wallets to have the same ownDid
    // as this would allow multiple wallets to decrypt an incoming message
    // and confuse message handling
    ownDid: {
        type: String,
        required: false,
        unique: true,
        sparse: true
    }
});

schema
    .virtual('handle')
    .get(function() {
        return this.__handle || -1;
    })
    .set(function(value) {
        this.__handle = value;
    });

schema.virtual('config').get(function() {
    return {
        id: this._id
    };
});

schema.method('open', async function() {
    log.debug('wallet model open');
    if (this.handle === -1) {
        this.handle = await indy.openWallet(this.config, this.credentials);
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

/**
 * Retrieve Wallet ownDid and verkey
 * @return {Promise<String[]>} [did, verkey]
 */
schema.methods.getPrimaryDid = async function getPrimaryDid() {
    return [this.ownDid, await indy.keyForLocalDid(this.handle, this.ownDid)];
};

schema.method('usableBy', function(user) {
    return this.owner.equals(user._id) || this.users.some(v => v.equals(user._id));
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
    throw new APIResult(400, { message: 'decryption failed, no fitting decryption key found' });
});

schema.method('getMyPairwiseDid', async function(theirDid) {
    const pairwiseInfo = await indy.getPairwise(this.handle, theirDid);
    return pairwiseInfo['my_did'];
});

schema.method('toMinObject', function() {
    let m = {};
    m.id = this._id;
    m.created = this.created;
    m.owner = typeof this.owner === 'object' ? this.owner._id.toString() : this.owner.toString();
    if (this.users) m.users = this.users;
    m.credentials = this.credentials;
    m.ownDid = this.ownDid;
    return m;
});

schema.pre('remove', async function() {
    log.debug('wallet model pre-remove');
    await this.close();
    await Mongoose.model('Message')
        .remove({ wallet: this })
        .exec();
    // Need to retrieve User model this way to prevent user object
    // from being empty due to cyclic dependency
    await Mongoose.model('User')
        .update({ wallet: this }, { $unset: { wallet: 1 } }, { multi: true })
        .exec();
    await indy.deleteWallet(this.config, this.credentials);
});

module.exports = Mongoose.model('Wallet', schema);
