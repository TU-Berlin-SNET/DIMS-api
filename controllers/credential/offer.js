/**
 * IDChain Agent REST API
 * Credential Offer Controller
 */
'use strict';

const log = require('../../log').log;
const lib = require('../../lib');
const Mongoose = require('../../db');

const Message = Mongoose.model('Message');

const Services = require('../../services');

const ConnectionService = Services.ConnectionService;
const MessageService = Services.MessageService;

const OFFER_MESSAGE_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/offer-credential';

module.exports = {
    OFFER_MESSAGE_TYPE,

    /**
     * List credential offers belonging to wallet
     * @param {Wallet} wallet
     * @return {Promise<Message[]>} array of credential offer messages
     */
    async list(wallet) {
        return Message.find({
            wallet: wallet.id,
            type: OFFER_MESSAGE_TYPE
        }).exec();
    },

    /**
     * Create and send a credential offer
     * @param {Wallet} wallet
     * @param {string} comment
     * @param {string} recipientDid
     * @param {string} credDefId
     * @param {string} [credentialLocation]
     * @return {Promise<Message>} Credential Offer object
     */
    async create(wallet, comment = '', recipientDid, credDefId, credentialLocation) {
        const connection = await ConnectionService.findOne(wallet, { theirDid: recipientDid });

        const id = await lib.crypto.generateId();
        const credentialOffer = await lib.sdk.issuerCreateCredentialOffer(wallet.handle, credDefId);
        const message = {
            '@id': id,
            '@type': OFFER_MESSAGE_TYPE,
            comment,
            'offers~attach': [
                {
                    '@id': id + '-1',
                    'mime-type': 'application/json',
                    data: {
                        base64: await lib.crypto.b64encode(credentialOffer)
                    }
                }
            ]
        };
        // ---

        // store and send message
        const meta = {
            offer: credentialOffer
        };
        if (credentialLocation) {
            meta.credentialLocation = credentialLocation;
        }
        const doc = await new Message({
            wallet: wallet.id,
            messageId: id,
            type: message['@type'],
            senderDid: connection.myDid,
            threadId: id,
            recipientDid,
            message,
            meta
        }).save();
        await MessageService.send(wallet, message, connection.endpoint);

        return doc;
    },

    /**
     * Retrieve a credential offer
     * @param {Wallet} wallet
     * @param {String} id offer _id (not message.id or nonce)
     * @return {Promise<Message>} credential offer or null
     */
    async retrieve(wallet, id) {
        return Message.findTypeById(wallet, id, OFFER_MESSAGE_TYPE).exec();
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
     * @param {*} senderVk
     * @param {*} recipientVk
     */
    async handle(wallet, message, senderVk, recipientVk) {
        log.debug('credential offer received');
        const connection = await ConnectionService.findOne(wallet, { myKey: recipientVk, theirKey: senderVk });
        if (!connection) {
            log.warn('received credential offer but there is no connection');
            // TODO needs better error handling
            return;
        }
        const decodedOffer = JSON.parse(lib.crypto.b64decode(message['offers~attach'][0].data.base64));
        const meta = { offer: decodedOffer };
        await new Message({
            wallet: wallet.id,
            messageId: message['@id'],
            threadId: message['@id'],
            type: message['@type'],
            senderDid: connection.theirDid,
            recipientDid: connection.myDid,
            message,
            meta
        }).save();
    }
};

MessageService.registerHandler(OFFER_MESSAGE_TYPE, module.exports.handle);
