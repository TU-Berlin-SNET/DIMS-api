/**
 * IDChain Agent REST API
 * Wallet Model
 */

const uuidv4 = require('uuid/v4');

const lib = require('../lib');
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
            unique: true,
            sparse: true
        },
        masterSecretId: {
            type: String,
            required: true
        }
    },
    { timestamps: true }
);

schema.loadClass(lib.Wallet);

schema.virtual('config').get(function() {
    return {
        id: this._id
    };
});

schema
    .virtual('handle')
    .get(function() {
        return this.__handle || -1;
    })
    .set(function(value) {
        this.__handle = value;
    });

// keep references to original methods of class in lib
// these are not supposed to be called directly but are used
// to passthrough values to the wallet when the proper method is used
schema.methods._setEndpointDid = schema.methods.setEndpointDid;
schema.methods._setMasterSecretId = schema.methods.setMasterSecretId;

schema.methods.getEndpointDid = async function() {
    return this.ownDid;
};

schema.methods.setEndpointDid = async function(value) {
    await this._setEndpointDid(value);
    this.ownDid = value;
};

schema.methods.getMasterSecretId = async function() {
    return this.masterSecretId;
};

schema.methods.setMasterSecretId = async function(value) {
    await this._setMasterSecretId(value);
    this.masterSecretId = value;
};

/**
 * Check if this wallet is usable by given user
 * @param {User} user
 * @return {Boolean}
 */
schema.methods.usableBy = function(user) {
    return this.owner.equals(user._id) || this.users.some(v => v.equals(user._id));
};

schema.set('toJSON', {
    depopulate: true,
    versionKey: false,
    transform: (doc, ret, options) => {
        ret.id = String(ret._id);
        delete ret._id;
    }
});

schema.pre('remove', async function() {
    log.debug('wallet model pre-remove');
    await this.close();
    const cascadeModels = ['Connection', 'Message', 'ProofRequestTemplate', 'Proof', 'Routing'];
    const cascadePromises = [];
    for (const modelName of cascadeModels) {
        cascadePromises.push(
            Mongoose.model(modelName)
                .remove({ wallet: this })
                .exec()
        );
    }
    cascadePromises.push(
        Mongoose.model('User')
            .update({ wallet: this }, { $unset: { wallet: 1 } }, { multi: true })
            .exec()
    );
    await Promise.all(cascadePromises);
    await this.delete();
});

module.exports = Mongoose.model('Wallet', schema);
