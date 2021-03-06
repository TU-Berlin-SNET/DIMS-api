/**
 * IDChain Agent REST API
 * Proof Controller
 */
'use strict';

const lib = require('../../lib');
const log = require('../../log').log;
const Mongoose = require('../../db');
const APIResult = require('../../util/api-result');

const messageTypes = lib.message.messageTypes;
const Message = Mongoose.model('Message');
const Proof = Mongoose.model('Proof');

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
     * @param {object} [values] object containing self-attested atributes as key-value pairs
     * @return {Promise<Message>}
     */
    async create(wallet, proofRequestId, values) {
        const requestDoc = await Message.findTypeById(wallet, proofRequestId, messageTypes.PROOFREQUEST).exec();
        if (!requestDoc || requestDoc.senderDid === wallet.ownDid) {
            throw APIResult.badRequest('invalid proof request id');
        }
        const proofRequest = requestDoc.message.message;
        const masterSecretId = await wallet.getMasterSecretId();
        const recipientDid = requestDoc.senderDid;
        const message = await lib.proof.create(wallet.handle, masterSecretId, recipientDid, proofRequest, values);
        const doc = await Message.store(
            wallet.id,
            message.id,
            messageTypes.PROOF,
            wallet.ownDid,
            recipientDid,
            message
        );

        await lib.message.sendAuthcrypt(wallet.handle, recipientDid, message);

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
     */
    async handle(wallet, message) {
        log.debug('received proof');
        const innerMessage = await lib.message.authdecrypt(wallet.handle, message.origin, message.message);
        message.message = innerMessage;

        // find corresponding proof request
        const requestDoc = await Message.findTypeByMessageId(wallet, message.id, messageTypes.PROOFREQUEST).exec();
        if (!requestDoc) {
            throw APIResult.badRequest('invalid request nonce');
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
        proofDoc.proof = message.message;
        proofDoc.meta = {
            proofRequest: requestDoc.message.message
        };
        await proofDoc.save();
    }
};
