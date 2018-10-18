const Mongoose = require('../db');
const MessageTypes = require('../lib').message.messageTypes;

const schema = new Mongoose.Schema(
    {
        wallet: {
            type: String,
            ref: 'Wallet',
            required: true,
            index: true
        },
        messageId: {
            type: String,
            required: true,
            index: true
        },
        type: {
            type: String,
            required: true
        },
        senderDid: {
            type: String
        },
        recipientDid: {
            type: String
        },
        message: {
            type: Mongoose.Schema.Types.Mixed,
            required: true
        },
        // optionally allow for an expire time to be set
        expireAt: {
            type: Date,
            default: undefined
        },
        meta: {}
    },
    // timestamps: true prompt mongoose to automatically handle
    // createdAt and updatedAt timestamp fields
    // minimize: false is necessary to prevent mongoose/mongodb
    // from unexpectedly removing data in certain fields (like mixed data fields)
    // and preventing certain bugs e.g. missing "committed_attributes" in credential request
    { timestamps: true, minimize: false }
);
// index expireAt to allow automatic handling of expiration
// note: mongoDB runs expire tasks once every 60 seconds
schema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

schema.set('toJSON', {
    versionKey: false,
    transform: (doc, ret, game) => {
        ret.id = String(ret._id);
        delete ret._id;
    }
});

/**
 * Find ConnectionOffer belonging to wallet by Id
 * @param {Wallet} wallet
 * @param {string} _id
 * @return {Query} Mongoose Query Object
 */
schema.statics.findConnectionOfferById = function findConnectionOfferById(wallet, _id) {
    return this.findTypeById(wallet, _id, MessageTypes.CONNECTIONOFFER);
};

/**
 * Find ConnectionRequest belonging to wallet by Id
 * @param {Wallet} wallet
 * @param {string} _id
 * @return {Query} Mongoose Query Object
 */
schema.statics.findConnectionRequestById = function findConnectionRequestById(wallet, _id) {
    return this.findTypeById(wallet, _id, MessageTypes.CONNECTIONREQUEST);
};

/**
 * Find ConnectionResponse belonging to wallet by Id
 * @param {Wallet} wallet
 * @param {string} _id
 * @return {Query} Mongoose Query Object
 */
schema.statics.findConnectionResponseById = function findConnectionResponseById(wallet, _id) {
    return this.findTypeById(wallet, _id, MessageTypes.CONNECTIONRESPONSE);
};

/**
 * Find Message with type belonging to wallet by Id
 * @param {Wallet} wallet
 * @param {string} _id
 * @param {string} type
 * @return {Query} Mongoose Query Object
 */
schema.statics.findTypeById = function findTypeById(wallet, _id, type) {
    return this.findOne({
        _id: _id,
        wallet: wallet.id,
        type: type
    });
};

/**
 * Find Message with type belonging to wallet by messageId
 * @param {Wallet} wallet
 * @param {string} messageId
 * @param {string} type
 * @return {Query} Mongoose Query Object
 */
schema.statics.findTypeByMessageId = function findTypeByMessageId(wallet, messageId, type) {
    return this.findOne({
        wallet: wallet.id,
        messageId: messageId,
        type: type
    });
};

/**
 * Create new Message and save
 * @param {string} walletId
 * @param {string} messageId
 * @param {string} messageType
 * @param {string} senderDid
 * @param {string} recipientDid
 * @param {Object} message
 * @param {Object} meta
 * @return {Promise<Message>}
 */
schema.statics.store = function store(walletId, messageId, messageType, senderDid, recipientDid, message, meta) {
    return new this({
        wallet: walletId,
        messageId: messageId,
        type: messageType,
        senderDid: senderDid,
        recipientDid: recipientDid,
        message: message,
        meta: meta
    }).save();
};

module.exports = Mongoose.model('Message', schema);
