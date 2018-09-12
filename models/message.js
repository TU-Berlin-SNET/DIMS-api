const Mongoose = require('../db');
const MessageTypes = require('../lib').message.messageTypes;

const schema = new Mongoose.Schema({
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
    meta: {}
});

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
 * @param {string} id
 * @return {Query} Mongoose Query Object
 */
schema.statics.findConnectionOfferById = function findConnectionOfferById(wallet, id) {
    return this.findTypeById(wallet, id, MessageTypes.CONNECTIONOFFER);
};

/**
 * Find ConnectionRequest belonging to wallet by Id
 * @param {Wallet} wallet
 * @param {string} id
 * @return {Query} Mongoose Query Object
 */
schema.statics.findConnectionRequestById = function findConnectionRequestById(wallet, id) {
    return this.findTypeById(wallet, id, MessageTypes.CONNECTIONREQUEST);
};

/**
 * Find ConnectionResponse belonging to wallet by Id
 * @param {Wallet} wallet
 * @param {string} id
 * @return {Query} Mongoose Query Object
 */
schema.statics.findConnectionResponseById = function findConnectionResponseById(wallet, id) {
    return this.findTypeById(wallet, id, MessageTypes.CONNECTIONRESPONSE);
};

/**
 * Find ConnectionOffer belonging to wallet by Id
 * @param {Wallet} wallet
 * @param {string} id
 * @param {string} type
 * @return {Query} Mongoose Query Object
 */
schema.statics.findTypeById = function findTypeById(wallet, id, type) {
    return this.findOne({
        _id: id,
        wallet: wallet.id,
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
