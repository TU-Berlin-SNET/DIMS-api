/**
 * IDChain Agent REST API
 * Connection Offer Controller
 */
'use strict';

const config = require('../../config');
const lib = require('../../lib');
const Mongoose = require('../../db');

const Message = Mongoose.model('Message');

module.exports = {
    /**
     * List connection offers belonging to wallet
     * @param {Wallet} wallet
     * @return {Promise<Message[]>} array of connection offers
     */
    async list(wallet) {
        return Message.find({
            wallet: wallet.id,
            type: lib.message.messageTypes.CONNECTIONOFFER
        }).exec();
    },

    /**
     * Create a connection offer
     * @param {Wallet} wallet
     * @param {object} [data] additional data to put in the offer
     * @param {object} [meta] additional meta information to store with offer (and later in pairwise)
     * @param {string} [role] role that is offered, e.g. TRUST_ANCHOR, ..
     * @param {string} [endpoint] my endpoint, default is derived from environment variables
     * @return {Promise<Message>} Message object including the connection offer
     */
    async create(wallet, data, meta = {}, role, endpoint = config.APP_AGENT_ENDPOINT) {
        const did = await wallet.getEndpointDid();
        const verkey = await lib.did.localKeyOf(wallet, did);
        const [myDid] = await lib.sdk.createAndStoreMyDid(wallet.handle, {});
        const offer = await lib.connection.buildOffer(did, verkey, endpoint);
        if (data && typeof data === 'object') offer.message.data = data;
        if (role && typeof role === 'string') meta.role = role;
        meta.myDid = myDid;
        const message = await Message.store(wallet.id, offer.id, offer.type, did, null, offer, meta);
        return message;
    },

    /**
     * Retrieve a connection offer
     * @param {Wallet} wallet
     * @param {String} id offer _id (not message.id or nonce)
     * @return {Promise<Message>} connection offer
     */
    async retrieve(wallet, id) {
        return Message.findConnectionOfferById(wallet, id).exec();
    },

    /**
     * Remove a connection offer
     * @param {Wallet} wallet
     * @param {String} id offer _id (not message.id or nonce)
     * @return {Promise<Message>} removed connection offer
     */
    async remove(wallet, id) {
        const offer = await Message.findConnectionOfferById(wallet, id).exec();
        if (offer) {
            await offer.remove();
        }
        return offer;
    },

    /**
     * Handle reception of connection offer through agent to agent communication
     * @param {Wallet} wallet
     * @param {object} message connection offer
     */
    async handle(wallet, message) {
        await Message.store(wallet.id, message.id, message.type, message.message.did, wallet.ownDid, message);
    }
};
