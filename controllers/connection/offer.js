/**
 * IDChain Agent REST API
 * Connection Offer Controller
 */
'use strict';

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
     * @param {string} [role] role that is offered, e.g. TRUST_ANCHOR, ..
     * @param {string} [endpoint] my endpoint, default is process.env.APP_ENDPOINT
     * @return {Promise<Message>} connection offer
     */
    async create(wallet, data, role, endpoint = process.env.APP_ENDPOINT) {
        const [did, vk] = await wallet.getPrimaryDid();
        const offer = await lib.connection.createConnectionOffer(did, vk, endpoint);
        let meta = null;
        if (data && typeof data === 'object') offer.message.data = data;
        if (role && typeof role === 'string') meta = { role: role };
        await Message.store(wallet.id, offer.id, offer.type, wallet.ownDid, null, offer, meta);
        return offer;
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
        await Message.store(wallet.id, message.id, message.type, message.message.did, wallet.ownDid, message.message);
    }
};
