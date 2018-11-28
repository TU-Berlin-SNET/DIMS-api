/**
 * IDChain Agent REST API
 * Wallet Model
 */

const indy = require('indy-sdk');
const lib = require('../lib');
const uuidv4 = require('uuid/v4');
const log = require('../log').log;
const Mongoose = require('../db');
const ObjectId = Mongoose.Schema.Types.ObjectId;

const schema = new Mongoose.Schema(
    {
        _id: {
            type: String,
            default: uuidv4
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
    },
    { timestamps: true }
);

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

schema.pre('remove', async function() {
    log.debug('wallet model pre-remove');
    await this.close();
    await Mongoose.model('Message')
        .remove({ wallet: this })
        .exec();
    await Mongoose.model('ProofRequestTemplate')
        .remove({ wallet: this })
        .exec();
    await Mongoose.model('Proof')
        .remove({ wallet: this })
        .exec();
    // Need to retrieve User model this way to prevent user object
    // from being empty due to cyclic dependency
    await Mongoose.model('User')
        .update({ wallet: this }, { $unset: { wallet: 1 } }, { multi: true })
        .exec();
    await indy.deleteWallet(this.config, this.credentials);
});

/**
 * Open this wallet (which populates wallet.handle)
 */
schema.methods.open = async function() {
    log.debug('wallet model open');
    if (this.handle === -1) {
        this.handle = await lib.sdk.openWallet(this.config, this.credentials);
    }
    return this.handle;
};

/**
 * Close this wallet (if opened, reset wallet.handle)
 */
schema.methods.close = async function() {
    log.debug('wallet model close');
    if (this.handle !== -1) {
        await lib.sdk.closeWallet(this.handle);
        this.handle = -1;
    }
};

/**
 * Retrieve Wallet ownDid and verkey
 * @return {Promise<String[]>} [did, verkey]
 */
schema.methods.getPrimaryDid = async function getPrimaryDid() {
    return [this.ownDid, await lib.sdk.keyForLocalDid(this.handle, this.ownDid)];
};

/**
 * Retrieve masterSecretId
 * @return {Promise<String>} masterSecretId
 */
schema.methods.getMasterSecretId = async function getMasterSecretId() {
    return lib.did.getDidMetaAttribute(this.handle, this.ownDid, 'masterSecretId');
};

/**
 * Check if this wallet is usable by given user
 * @param {User} user
 * @return {Boolean}
 */
schema.methods.usableBy = function(user) {
    return this.owner.equals(user._id) || this.users.some(v => v.equals(user._id));
};

/**
 * Return minimal object of wallet
 * @return {Object}
 */
schema.methods.toMinObject = function() {
    let m = {};
    m.id = this._id;
    m.owner = typeof this.owner === 'object' ? this.owner._id.toString() : this.owner.toString();
    m.credentials = this.credentials;
    m.ownDid = this.ownDid;
    m.createdAt = this.createdAt;
    m.updatedAt = this.updatedAt;
    if (this.users) {
        m.users = this.users;
    }
    return m;
};

module.exports = Mongoose.model('Wallet', schema);
