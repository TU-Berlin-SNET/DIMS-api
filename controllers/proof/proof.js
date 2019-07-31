/**
 * IDChain Agent REST API
 * Proof Controller
 */
'use strict';

const lib = require('../../lib');
const log = require('../../log');
const Mongoose = require('../../db');
const APIResult = require('../../util/api-result');

const Message = Mongoose.model('Message');
const Proof = Mongoose.model('Proof');
const Services = require('../../services');

const ConnectionService = Services.ConnectionService;
const MessageService = Services.MessageService;

const REQUEST_MESSAGE_TYPE = require('./request').REQUEST_MESSAGE_TYPE;
const PRESENTATION_MESSAGE_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/present-proof/1.0/presentation';

module.exports = {
    /**
     * List proofs belonging to wallet (only received or pending)
     * @param {Wallet} wallet
     * @return {Promise<Message[]>}
     */
    async list(wallet) {
        return Proof.find({
            wallet: wallet.id
        }).exec();
    },

    /**
     * Accept a proof request and create and send a proof
     * @param {Wallet} wallet
     * @param {string} proofRequestId _id of proof request message
     * @param {string} [comment]
     * @param {object} [values] object containing self-attested atributes as key-value pairs
     * @return {Promise<Message>}
     */
    async create(wallet, proofRequestId, comment = '', values) {
        const requestDoc = await Message.findTypeById(wallet, proofRequestId, REQUEST_MESSAGE_TYPE).exec();
        const connection = await ConnectionService.findOne(wallet, {
            myDid: requestDoc.recipientDid,
            theirDid: requestDoc.senderDid
        });
        if (!requestDoc || !connection) {
            throw APIResult.badRequest('invalid proof request id');
        }
        const proofRequest = requestDoc.meta.proofRequest;
        const masterSecretId = await wallet.getMasterSecretId();
        const proof = await lib.proof.create(wallet.handle, masterSecretId, connection.myDid, proofRequest, values);

        const id = await lib.crypto.generateId();
        const message = {
            '@id': id,
            '@type': PRESENTATION_MESSAGE_TYPE,
            '~thread': { thid: requestDoc.threadId },
            comment,
            'presentations~attach': [
                {
                    '@id': id + '-1',
                    'mime-type': 'application/json',
                    data: { base64: lib.crypto.b64encode(proof) }
                }
            ]
        };
        const meta = requestDoc.meta;
        meta.proof = proof;
        const doc = await new Message({
            wallet: wallet.id,
            messageId: id,
            threadId: message['~thread'].thid,
            type: message['@type'],
            senderDid: connection.myDid,
            recipientDid: connection.theirDid,
            message,
            meta
        }).save();

        await MessageService.send(wallet, message, connection.endpoint);

        return doc;
    },

    /**
     * Retrieve a received proof
     * @param {Wallet} wallet
     * @param {String} id proof _id
     * @return {Promise<Proof>}
     */
    async retrieve(wallet, id) {
        const proof = await Proof.findOne({
            _id: id,
            wallet: wallet.id
        }).exec();
        if (!proof) {
            log.debug('no proof object found');
            return proof;
        }
        if (proof.proof) {
            log.debug('verifying proof');
            proof.isValid = await lib.proof.verify(wallet.ownDid, proof.meta.proofRequest, proof.proof);
        }
        await proof.save();
        log.debug('retrieved proof');
        return proof;
    },

    /**
     * Remove a received proof
     * @param {Wallet} wallet
     * @param {String} id proof _id
     * @return {Promise<Proof>}
     */
    async remove(wallet, id) {
        const proof = await Proof.findOne({
            _id: id,
            wallet: wallet.id
        }).exec();
        if (proof) {
            await proof.remove();
        }
        return proof;
    },

    /**
     * Handle reception of proof through agent to agent communication
     * @param {Wallet} wallet
     * @param {object} message
     * @param {string} senderVk
     * @param {string} recipientVk
     */
    async handle(wallet, message, senderVk, recipientVk) {
        log.debug('received proof');

        const connection = await ConnectionService.findOne(wallet, { myKey: recipientVk, theirKey: senderVk });

        // find corresponding proof request
        const requestDoc = await Message.findOne({
            wallet: wallet.id,
            type: REQUEST_MESSAGE_TYPE,
            threadId: message['~thread'].thid,
            senderDid: connection.myDid,
            recipientDid: connection.theirDid
        }).exec();
        if (!connection || !requestDoc) {
            throw APIResult.badRequest('no applicable request found');
        }
        // remove to prevent replays
        await requestDoc.remove();
        // ok, proof was requested so continue

        const proofDoc = await Proof.findById(requestDoc.meta.proofId).exec();
        if (!proofDoc) {
            // if there is no proof doc then it was deleted by the user
            // e.g. recipient has no interest in it anymore
            // so do not store it and return
            return;
        }

        // populate proof doc and save it
        proofDoc.status = 'received';
        proofDoc.proof = JSON.parse(lib.crypto.b64decode(message['presentations~attach'][0].data.base64));
        // meta includes decoded proof request
        proofDoc.meta = requestDoc.meta;
        await proofDoc.save();
    }
};

MessageService.registerHandler(PRESENTATION_MESSAGE_TYPE, module.exports.handle);
