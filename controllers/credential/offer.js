/**
 * IDChain Agent REST API
 * Credential Offer Controller
 */
'use strict';

const log = require('../../log').log;
const lib = require('../../lib');
const Mongoose = require('../../db');
const Message = Mongoose.model('Message');
const messageTypes = lib.message.messageTypes;

module.exports = {
    /**
     * List credential offers belonging to wallet
     * @param {Wallet} wallet
     * @return {Promise<Message[]>} array of credential offer messages
     */
    async list(wallet) {
        return Message.find({
            wallet: wallet.id,
            type: messageTypes.CREDENTIALOFFER
        }).exec();
    },

    /**
     * Create and send a credential offer
     * @param {Wallet} wallet
     * @param {string} recipientDid
     * @param {string} credDefId
     * @param {string} [credentialLocation]
     * @return {Promise<Message>} Credential Offer object
     */
    async create(wallet, recipientDid, credDefId, credentialLocation) {
        const message = await lib.credential.createCredentialOffer(wallet.handle, credDefId, recipientDid);

        // store and send message
        const meta = credentialLocation ? { credentialLocation: credentialLocation } : {};
        const doc = await Message.store(
            wallet.id,
            message.message.nonce,
            message.type,
            wallet.ownDid,
            recipientDid,
            message,
            meta
        );
        await lib.message.sendAuthcryptMessage(wallet.handle, recipientDid, message);

        return doc;
    },

    /**
     * Retrieve a credential offer
     * @param {Wallet} wallet
     * @param {String} id offer _id (not message.id or nonce)
     * @return {Promise<Message>} credential offer or null
     */
    async retrieve(wallet, id) {
        return Message.findTypeById(wallet, id, messageTypes.CREDENTIALOFFER).exec();
    },

    /**
     * Remove a credential offer
     * @param {Wallet} wallet
     * @param {String} id offer _id (not message.id or nonce)
     * @return {Promise<Message>} removed credential offer or null
     */
    async remove(wallet, id) {
        const offer = await module.exports.retrieve(wallet, id);
        if (offer) {
            await offer.remove();
        }
        return offer;
    },

    /**
     * Handle reception of credential offer through agent to agent communication
     * @param {Wallet} wallet
     * @param {object} message credential offer
     */
    async handle(wallet, message) {
        log.debug('credential offer received');
        const offer = await lib.message.authdecryptMessage(wallet.handle, message.origin, message.message);
        message.message = offer;
        await Message.store(wallet.id, message.id, message.type, message.origin, wallet.ownDid, message);
    }
};
