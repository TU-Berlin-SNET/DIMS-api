/**
 * IDChain Agent REST API
 * Credential Request Controller
 */
'use strict';

const lib = require('../../lib');
const log = require('../../log').log;
const Mongoose = require('../../db');
const APIResult = require('../../util/api-result');
const Credential = require('./credential');

const Message = Mongoose.model('Message');
const CredentialOfferController = require('./offer');
const Services = require('../../services');

const ConnectionService = Services.ConnectionService;
const MessageService = Services.MessageService;

const REQUEST_MESSAGE_TYPE = 'urn:sovrin:agent:message_type:sovrin.org/credential_request';

module.exports = {
    /**
     * List credential requests belonging to wallet (sent or received)
     * @param {Wallet} wallet
     * @return {Promise<Message[]>}
     */
    async list(wallet) {
        return Message.find({
            wallet: wallet.id,
            type: REQUEST_MESSAGE_TYPE
        }).exec();
    },

    /**
     * Create and send a credential request
     * @param {Wallet} wallet
     * @param {(string | object)} credentialOffer _id or decrypted credential offer message
     * @return {Promise<Message>}
     */
    async create(wallet, credentialOffer) {
        let offerDoc;
        if (typeof credentialOffer === 'string') {
            offerDoc = await Message.findTypeById(
                wallet,
                credentialOffer,
                CredentialOfferController.OFFER_MESSAGE_TYPE
            ).exec();
            credentialOffer = offerDoc ? offerDoc.message : null;
        }
        if (!credentialOffer) {
            throw APIResult.badRequest('invalid credential offer or no applicable credential offer found');
        }
        const connection = await ConnectionService.findOne(wallet, { theirDid: credentialOffer.origin });
        const [, credentialDefinition] = await lib.ledger.getCredDef(
            connection.myDid,
            credentialOffer.message.cred_def_id
        );
        const masterSecretId = await wallet.getMasterSecretId();
        const [message, requestMeta] = await lib.credential.buildRequest(
            wallet.handle,
            connection.myDid,
            credentialOffer.message,
            credentialDefinition,
            masterSecretId
        );
        const doc = await Message.store(
            wallet.id,
            message.message.nonce,
            message.type,
            wallet.ownDid,
            credentialOffer.origin,
            message,
            requestMeta
        );
        offerDoc && (await offerDoc.remove());

        await MessageService.send(wallet, message, connection.endpoint);

        return doc;
    },

    /**
     * Retrieve a credential request
     * @param {Wallet} wallet
     * @param {String} id request _id (not message.id or nonce)
     * @return {Promise<Message>}
     */
    async retrieve(wallet, id) {
        return Message.findTypeById(wallet, id, REQUEST_MESSAGE_TYPE).exec();
    },

    /**
     * Remove a credential request
     * @param {Wallet} wallet
     * @param {String} id request _id (not message.id or nonce)
     * @return {Promise<Message>}
     */
    async remove(wallet, id) {
        const request = await module.exports.retrieve(wallet, id);
        if (request) {
            await request.remove();
        }
        return request;
    },

    /**
     * Handle reception of credential request through agent to agent communication
     * @param {Wallet} wallet
     * @param {object} message
     */
    async handle(wallet, message) {
        log.debug('received credential request');

        // find corresponding credential offer (use nonce for querying -> nonce match is established)
        const offer = await Message.findTypeByMessageId(
            wallet,
            message.id,
            CredentialOfferController.OFFER_MESSAGE_TYPE
        ).exec();

        // 2018-10-19: we (and indy-sdk) currently do not support credential requests as the
        // first message in the credential issue flow, a credential offer must always exist
        // and we MUST be the sender of that credential offer, otherwise we reject the request
        if (!offer || offer.senderDid !== wallet.ownDid) {
            throw APIResult.badRequest('no applicable credential offer found');
        }

        const meta = offer.meta || {};
        meta.offer = offer.message.message;

        // remove credential offer to prevent replays
        await offer.remove();

        // request is valid so store it
        const request = await Message.store(
            wallet.id,
            message.message.nonce,
            message.type,
            message.origin,
            wallet.ownDid,
            message,
            meta
        );

        // automatically issue and send credential if credentialLocation exists in metadata
        if (request.meta.credentialLocation) {
            await Credential.create(wallet, request);
        }
    }
};

MessageService.registerHandler(REQUEST_MESSAGE_TYPE, module.exports.handle);
