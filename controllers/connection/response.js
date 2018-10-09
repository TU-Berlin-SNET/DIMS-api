/**
 * IDChain Agent REST API
 * Connection Response Controller
 */
'use strict';

const lib = require('../../lib');
const log = require('../../log').log;
const Mongoose = require('../../db');
const pool = require('../../pool');
const APIResult = require('../../api-result');
const ConnectionAcknowledgement = require('./acknowledgement');
const Message = Mongoose.model('Message');

module.exports = {
    /**
     * Create and send a connection response,
     * i.e. accept a connection request
     * @param {Wallet} wallet
     * @param {(string | object)} request connection request id or object
     * @return {Promise<Message>} Message - connection request object
     */
    async create(wallet, request) {
        if (typeof request === 'string') {
            request = await Message.findConnectionRequestById(wallet, request).exec();
        }
        if (!request || request.recipientDid !== wallet.ownDid) {
            throw APIResult.badRequest('no corresponding connection request found');
        }
        const message = request.message.message;
        const [theirDid, theirVk] = await lib.did.ensureDidInfo(wallet.handle, pool, message.did, message.verkey, true);
        const [theirEndpointDid, theirEndpointVk, theirEndpoint] = await lib.did.ensureDidInfo(
            wallet.handle,
            pool,
            message.endpointDid,
            message.endpointVk,
            message.endpoint
        );
        const requestNonce = message.nonce;
        const meta = request.meta || {};

        // if we specifically added a role to our offer then this role
        // will be in the request object as this means that this method
        // was called automatically after receiving a connection request
        // through agent-to-agent communication, also see: request.js handle method
        if (meta && meta.role) {
            // then write their did on the ledger with that role
            // (this might have implications for GDPR)
            await pool.nymRequest(wallet.handle, wallet.ownDid, theirDid, theirVk, null, meta.role);
        }
        meta.theirEndpointDid = theirEndpointDid;
        meta.theirEndpointVk = theirEndpointVk;
        meta.theirEndpoint = theirEndpoint;
        meta.acknowledged = false;

        let myDid;
        let myVk;
        // if there is no connection record (and myDid)
        if (!meta.myDid) {
            // create did, vk, and record
            [myDid, myVk] = await lib.sdk.createAndStoreMyDid(wallet.handle, {});
            await lib.record.addWalletRecord(wallet.handle, lib.record.types.connection, myDid, { theirDid: theirDid });
        } else {
            // else retrieve did and vk
            myDid = meta.myDid;
            myVk = await lib.sdk.keyForLocalDid(wallet.handle, myDid);

            // delete meta.myDid so we do not store redundant information in pairwise meta
            delete meta.myDid;

            // update the record value
            await lib.record.updateWalletRecordValue(wallet.handle, lib.record.types.connection, myDid, {
                theirDid: theirDid
            });
        }

        // store their did and create pairwise
        await lib.connection.createRelationship(wallet.handle, myDid, theirDid, theirVk, meta);

        // create the connection response, anoncrypt inner message for pairwise recipient
        const response = await lib.connection.createConnectionResponse(myDid, myVk, theirDid, requestNonce);
        const encryptedMessage = await lib.crypto.anonCryptJSON(theirVk, response.message);
        // anoncrypt whole message for endpoint and send it
        await lib.message.sendAnoncryptMessage(
            theirEndpointVk,
            theirEndpoint,
            Object.assign({}, response, { message: encryptedMessage })
        );

        // clean up: remove the request
        await request.remove();

        // return unencrypted connection response to caller
        // connection response is not stored in the database
        // because now there is a pairwise
        return response;
    },

    /**
     * Handle reception of connection response through agent to agent communication
     * @param {Wallet} wallet
     * @param {object} message connection response
     */
    async handle(wallet, message) {
        log.debug('received connection response');
        const request = await Message.findOne({
            messageId: message.id,
            type: lib.message.messageTypes.CONNECTIONREQUEST,
            wallet: wallet.id
        }).exec();
        // nonce is already checked through query

        // we can not accept a response to a request whose recipient we are
        if (!request || request.recipientDid === wallet.ownDid) {
            throw APIResult.badRequest('no applicable connection request found');
        }
        // we will not accept a response which is addressed wrongly
        if (message.aud !== request.senderDid) {
            throw APIResult.badRequest('aud/did mismatch');
        }

        // retrieve my information and decrypt inner message
        const myDid = request.senderDid;
        const myVk = await lib.sdk.keyForLocalDid(wallet.handle, myDid);
        const response = await lib.crypto.anonDecryptJSON(wallet.handle, myVk, message.message);
        const [theirDid, theirVk] = await lib.did.ensureDidInfo(
            wallet.handle,
            pool,
            response.did,
            response.verkey,
            request.meta.theirEndpoint
        );

        // update the record value
        await lib.record.updateWalletRecordValue(wallet.handle, lib.record.types.connection, myDid, {
            theirDid: theirDid
        });

        // create the relationship, e.g. store their did and create a pairwise
        delete request.meta.myDid;
        request.meta.acknowledged = true;
        await lib.connection.createRelationship(wallet.handle, myDid, theirDid, theirVk, request.meta);

        return await ConnectionAcknowledgement.create(
            wallet,
            myDid,
            myVk,
            theirDid,
            theirVk,
            request.meta.theirEndpointVk,
            request.meta.theirEndpoint
        );
    }
};
