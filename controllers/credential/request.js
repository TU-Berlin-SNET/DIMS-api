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

const REQUEST_MESSAGE_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/request-credential';

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
     * @param {string} comment
     * @param {string} credentialOffer _id
     * @return {Promise<Message>}
     */
    async create(wallet, comment = '', credentialOffer) {
        const offerDoc = await Message.findTypeById(
            wallet,
            credentialOffer,
            CredentialOfferController.OFFER_MESSAGE_TYPE
        ).exec();
        const offer = offerDoc.meta.offer;
        if (!offerDoc) {
            throw APIResult.badRequest('invalid credential offer or no applicable credential offer found');
        }
        const connection = await ConnectionService.findOne(wallet, {
            myDid: offerDoc.recipientDid,
            theirDid: offerDoc.senderDid
        });
        const [, credentialDefinition] = await lib.ledger.getCredDef(connection.myDid, offer.cred_def_id);
        const masterSecretId = await wallet.getMasterSecretId();
        const [request, requestMeta] = await lib.sdk.proverCreateCredentialReq(
            wallet.handle,
            connection.myDid,
            offer,
            credentialDefinition,
            masterSecretId
        );
        const id = await lib.crypto.generateId();
        const requestMessage = {
            '@id': id,
            type: REQUEST_MESSAGE_TYPE,
            comment,
            '~thread': { thid: offerDoc.threadId },
            'requests~attach': [
                {
                    '@id': id + '1',
                    'mime-type': 'application/json',
                    data: { base64: lib.crypto.b64encode(request) }
                }
            ]
        };
        const meta = offerDoc.meta;
        meta.request = request;
        meta.requestMeta = requestMeta;
        const doc = await new Message({
            wallet: wallet.id,
            messageId: id,
            threadId: offerDoc.threadId,
            type: REQUEST_MESSAGE_TYPE,
            senderDid: connection.myDid,
            recipientDid: connection.theirDid,
            message: requestMessage,
            meta
        }).save();
        await offerDoc.remove();

        await MessageService.send(wallet, doc.message, connection.endpoint);

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
     * @param {string} senderVk
     * @param {string} recipientVk
     */
    async handle(wallet, message, senderVk, recipientVk) {
        log.debug('received credential request');

        // find corresponding credential offer (using threadId)
        const offer = await Message.findOne({
            wallet: wallet.id,
            threadId: message['~thread'].thid,
            type: CredentialOfferController.OFFER_MESSAGE_TYPE
        }).exec();
        const connection = await ConnectionService.findOne(wallet, { myKey: recipientVk, theirKey: senderVk });

        // 2018-10-19: we (and indy-sdk) currently do not support credential requests as the
        // first message in the credential issue flow, a credential offer must always exist
        // and we MUST be the sender of that credential offer, otherwise we reject the request
        if (!offer || offer.senderDid !== connection.myDid) {
            throw APIResult.badRequest('no applicable credential offer found');
        }

        const meta = offer.meta;
        meta.request = JSON.parse(lib.crypto.b64decode(message['requests~attach'][0].data.base64));

        // remove credential offer to prevent replays
        await offer.remove();

        // request is valid so store it
        const requestDoc = await new Message({
            wallet: wallet.id,
            messageId: message['@id'],
            threadId: message['~thread'].thid,
            type: message.type,
            senderDid: connection.theirDid,
            recipientDid: connection.myDid,
            message,
            meta
        }).save();

        // automatically issue and send credential if credentialLocation exists in metadata
        if (requestDoc.meta.credentialLocation) {
            await Credential.create(wallet, 'credential', requestDoc);
        }
    }
};

MessageService.registerHandler(REQUEST_MESSAGE_TYPE, module.exports.handle);
