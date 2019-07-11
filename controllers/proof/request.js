/**
 * IDChain Agent REST API
 * Proof Request Controller
 */
'use strict';

const Mustache = require('mustache');
const lib = require('../../lib');
const log = require('../../log').log;
const Mongoose = require('../../db');
const APIResult = require('../../util/api-result');

const Proof = Mongoose.model('Proof');
const Message = Mongoose.model('Message');
const ProofRequestTemplate = Mongoose.model('ProofRequestTemplate');
const Services = require('../../services');

const ConnectionService = Services.ConnectionService;
const MessageService = Services.MessageService;

const REQUEST_MESSAGE_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/present-proof/1.0/request-presentation';

module.exports = {
    REQUEST_MESSAGE_TYPE,

    /**
     * List proof requests belonging to wallet (sent or received)
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
     * Create and send a proof request
     * @param {Wallet} wallet
     * @param {string} recipientDid
     * @param {string} [comment]
     * @param {(string | object)} proofRequest _id of proof request template or proof request object
     * @param {object} [templateValues] values to use for rendering the template
     * @return {Promise<Message>}
     */
    async create(wallet, recipientDid, comment = '', proofRequest, templateValues) {
        const connection = await ConnectionService.findOne(wallet, { theirDid: recipientDid });
        if (
            !connection ||
            ![lib.connection.STATE.RESPONDED, lib.connection.STATE.COMPLETE].includes(connection.state)
        ) {
            throw APIResult.badRequest('invalid recipientDid, no applicable connection found');
        }

        // proofRequest === string -> it is a template _id so retrieve it
        if (typeof proofRequest === 'string') {
            const templateDoc = await ProofRequestTemplate.findOne({
                _id: proofRequest,
                wallet: wallet.id
            }).exec();
            proofRequest = templateDoc ? JSON.parse(Mustache.render(templateDoc.template, templateValues)) : null;
        }
        if (!proofRequest) {
            throw APIResult.badRequest('invalid proof request or no applicable proof request template found');
        }
        if (!proofRequest.nonce) {
            proofRequest.nonce = await lib.crypto.getNonce();
        }
        const id = await lib.crypto.generateId();
        const message = {
            '@id': id,
            '@type': REQUEST_MESSAGE_TYPE,
            '~thread': { thid: id },
            comment,
            'request_presentations~attach': [
                {
                    '@id': id + '-1',
                    'mime-type': 'application/json',
                    data: { base64: lib.crypto.b64encode(proofRequest) }
                }
            ]
        };

        // create placeholder for expected proof, this will allow for checking the status later on
        const proof = await new Proof({
            wallet: wallet.id,
            did: recipientDid
        }).save();

        const meta = { proofId: proof.id, proofRequest };
        const doc = await new Message({
            wallet: wallet.id,
            type: message['@type'],
            messageId: id,
            threadId: id,
            senderDid: connection.myDid,
            recipientDid,
            message,
            meta
        }).save();

        await MessageService.send(wallet, message, connection.endpoint);

        return doc;
    },

    /**
     * Retrieve a proof request
     * @param {Wallet} wallet
     * @param {String} id request _id (not message.id or nonce)
     * @return {Promise<Message>}
     */
    async retrieve(wallet, id) {
        return Message.findTypeById(wallet, id, REQUEST_MESSAGE_TYPE).exec();
    },

    /**
     * Remove a proof request
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
     * Handle reception of proof request through agent to agent communication
     * @param {Wallet} wallet
     * @param {object} message
     * @param {string} senderVk
     * @param {string} recipientVk
     */
    async handle(wallet, message, senderVk, recipientVk) {
        log.debug('received proof request');
        const connection = await ConnectionService.findOne(wallet, { myKey: recipientVk, theirKey: senderVk });
        if (!connection) {
            log.warn('received credential but there is no connection?');
            return;
        }

        // message was successfully auth-decrypted which means we have a pairwise with the sender and
        // proof request can be the initial message in the flow

        const proofRequest = JSON.parse(lib.crypto.b64decode(message['request_presentations~attach'][0].data.base64));
        const meta = { proofRequest };

        await new Message({
            wallet: wallet.id,
            messageId: message['@id'],
            type: message['@type'],
            threadId: message['~thread'].thid,
            senderDid: connection.theirDid,
            recipientDid: connection.myDid,
            message,
            meta
        }).save();
    }
};

MessageService.registerHandler(REQUEST_MESSAGE_TYPE, module.exports.handle);
