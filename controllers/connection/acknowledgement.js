/**
 * IDChain Agent REST API
 * Connection Acknowledgement Controller
 */
'use strict';

const lib = require('../../lib');
const log = require('../../log').log;
const APIResult = require('../../api-result');

module.exports = {
    /**
     * Create and send a connection acknowledgement
     * @param {Wallet} wallet my wallet
     * @param {string} myDid my pairwise did
     * @param {string} myVk my pairwise verkey
     * @param {string} theirDid their pairwise did
     * @param {string} theirVk their pairwise verkey
     * @param {string} theirEndpointVk their endpoint verkey
     * @param {string} theirEndpoint their endpoint address
     * @return {Promise<Object>} connection acknowledgement - unencrypted
     */
    async create(wallet, myDid, myVk, theirDid, theirVk, theirEndpointVk, theirEndpoint) {
        // create connection acknowledgement, authcrypt inner message and send it
        const ack = await lib.connection.createConnectionAcknowledgement(myDid);
        const encryptedMessage = await lib.crypto.authCrypt(wallet.handle, myVk, theirVk, ack.message);
        await lib.message.sendAnoncryptMessage(
            theirEndpointVk,
            theirEndpoint,
            Object.assign({}, ack, { message: encryptedMessage })
        );
        return ack;
    },

    /**
     * Handle reception of connection acknowledgement through agent to agent communication
     * @param {Wallet} wallet
     * @param {object} message connection acknowledgement
     */
    async handle(wallet, message) {
        const theirDid = message.id;
        if (!(await lib.sdk.isPairwiseExists(wallet.handle, theirDid))) {
            throw APIResult.badRequest('unknown sender did');
        }
        const pairwise = await lib.pairwise.getPairwise(wallet.handle, theirDid);
        const myVk = await lib.sdk.keyForLocalDid(wallet.handle, pairwise['my_did']);
        const ackMessage = await lib.crypto.authDecrypt(wallet.handle, myVk, message.message);
        const compareMessage = ackMessage.toLowerCase();
        if (compareMessage !== 'success') {
            log.warn('invalid message string in connection acknowledgement %s', ackMessage);
            throw APIResult.badRequest('invalid message string in connection acknowledgement');
        }
        pairwise.metadata.acknowledged = true;
        await lib.pairwise.setPairwiseMetadata(wallet.handle, theirDid, pairwise.metadata);
    }
};
