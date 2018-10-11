/**
 * IDChain Agent REST API
 * Connection Request Controller
 */
'use strict';

const lib = require('../../lib');
const Mongoose = require('../../db');
const pool = require('../../pool');
const log = require('../../log').log;
const APIResult = require('../../api-result');
const ConnectionResponse = require('./response');

const Message = Mongoose.model('Message');

module.exports = {
    /**
     * List connection requests belonging to wallet
     * @param {Wallet} wallet
     * @return {Promise<Message[]>} array of connection requests
     */
    async list(wallet) {
        return Message.find({
            wallet: wallet.id,
            type: lib.message.messageTypes.CONNECTIONREQUEST
        }).exec();
    },

    /**
     * Create and send a connection request,
     * i.e. send a initial request (with theirDid/Vk/Endpoint)
     * or accept a connection offer (with connectionOffer)
     * @param {Wallet} wallet
     * @param {string} myEndpoint
     * @param {string} [theirDid]
     * @param {string} [theirVk]
     * @param {string} [theirEndpoint]
     * @param {object} [connectionOffer]
     * @return {Promise<Message>} Message - connection request object
     */
    async create(wallet, myEndpoint = process.env.APP_ENDPOINT, theirDid, theirVk, theirEndpoint, connectionOffer) {
        const [theirEndpointDid, theirEndpointVk, theirEndpointAddress] = await lib.did.ensureDidInfo(
            wallet.handle,
            pool,
            (connectionOffer && connectionOffer.message.did) || theirDid,
            (connectionOffer && connectionOffer.message.verkey) || theirVk,
            (connectionOffer && connectionOffer.message.endpoint) || theirEndpoint
        );
        const offerNonce = (connectionOffer && connectionOffer.message.nonce) || null;
        // create my pairwise did and the connection request
        const [myDid, myVk] = await lib.sdk.createAndStoreMyDid(wallet.handle, {});
        const [ownDid, ownVk] = await wallet.getPrimaryDid();
        const connectionRequest = await lib.connection.createConnectionRequest(
            ownDid,
            ownVk,
            myDid,
            myVk,
            myEndpoint,
            offerNonce
        );
        const meta = {
            myDid: myDid,
            theirEndpointDid: theirEndpointDid,
            theirEndpointVk: theirEndpointVk,
            theirEndpoint: theirEndpointAddress
        };
        const message = await Message.store(
            wallet.id,
            connectionRequest.message.nonce,
            connectionRequest.type,
            connectionRequest.message.did,
            theirEndpointDid,
            connectionRequest,
            meta
        );
        await lib.message.sendAnoncryptMessage(theirEndpointVk, theirEndpointAddress, connectionRequest);
        return message;
    },

    /**
     * Retrieve a connection request
     * @param {Wallet} wallet
     * @param {String} id request _id (not message.id or nonce)
     * @return {Promise<Message>} connection request
     */
    async retrieve(wallet, id) {
        return Message.findConnectionRequestById(wallet, id).exec();
    },

    /**
     * Remove a connection request
     * @param {Wallet} wallet
     * @param {String} id request _id (not message.id or nonce)
     * @return {Promise<Message>} removed connection request
     */
    async remove(wallet, id) {
        const request = await Message.findConnectionRequestById(wallet, id).exec();
        if (request) {
            await request.remove();
        }
        return request;
    },

    /**
     * Handle reception of connection request through agent to agent communication
     * @param {Wallet} wallet
     * @param {object} message connection request
     */
    async handle(wallet, message) {
        log.debug('received connection request');
        const offer = await Message.findOne({
            messageId: message.id,
            type: lib.message.messageTypes.CONNECTIONOFFER,
            wallet: wallet.id
        }).exec();
        // the nonce is used to query, so no additional check is needed

        // we must be the sender of the connection request
        if (offer && offer.senderDid !== wallet.ownDid) {
            throw APIResult.badRequest('invalid connection offer nonce');
        }

        // valid request, at least store it
        const request = await Message.store(
            wallet.id,
            message.message.nonce,
            message.type,
            message.message.did,
            wallet.ownDid,
            message,
            offer ? offer.meta : {}
        );

        // and if there is a corresponding connection offer
        // automatically accept it
        if (offer) {
            await ConnectionResponse.create(wallet, request);
            await offer.remove();
        }
    }
};
