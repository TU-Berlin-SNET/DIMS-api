/**
 * Indy Messages
 */
'use strict';

const agent = require('superagent');
const sdk = require('indy-sdk');
const crypto = require('./crypto');
const pairwise = require('./pairwise');

module.exports = {
    messageTypes: {
        CONNECTIONOFFER: 'urn:sovrin:agent:message_type:sovrin.org/connection_offer',
        CONNECTIONREQUEST: 'urn:sovrin:agent:message_type:sovrin.org/connection_request',
        CONNECTIONRESPONSE: 'urn:sovrin:agent:message_type:sovrin.org/connection_response',
        CONNECTIONACKNOWLEDGE: 'urn:sovrin:agent:message_type:sovrin.org/connection_acknowledge',
        CREDENTIALOFFER: 'urn:sovrin:agent:message_type:sovrin.org/credential_offer',
        CREDENTIALREQUEST: 'urn:sovrin:agent:message_type:sovrin.org/credential_request',
        CREDENTIAL: 'urn:sovrin:agent:message_type:sovrin.org/credential',
        PROOFREQUEST: 'urn:sovrin:agent:message_type:sovrin.org/proof_request',
        PROOF: 'urn:sovrin:agent:message_type:sovrin.org/proof',
        DIDAUTHREQUEST: 'did:placeholder;spec/dims/didauth/1.0/request',
        DIDAUTHRESPONSE: 'did:placeholder;spec/dims/didauth/1.0/response'
    },

    /**
     * Send message to endpoint
     * @param {string} endpoint
     * @param {string} message
     * @return {SuperAgentRequest}
     */
    send(endpoint, message) {
        return agent
            .post(endpoint)
            .type('application/json')
            .send({
                message: message
            });
    },

    /**
     * Anoncrypt and send message
     * @param {string} recipientVk
     * @param {string} endpoint
     * @param {(string | Object)} message
     * @return {SuperAgentRequest}
     */
    async sendAnoncrypt(recipientVk, endpoint, message) {
        return module.exports.send(endpoint, await crypto.anonCrypt(recipientVk, message));
    },

    /**
     * Authcrypt inner message, anoncrypt whole payload and send message
     * @param {number} walletHandle
     * @param {string} recipientDid
     * @param {object} message
     * @return {Promise<SuperAgentRequest>}
     */
    async sendAuthcrypt(walletHandle, recipientDid, message) {
        const pairwiseInfo = await pairwise.retrieve(walletHandle, recipientDid);
        const senderVk = await sdk.keyForLocalDid(walletHandle, pairwiseInfo['my_did']);
        const recipientVk = await sdk.keyForLocalDid(walletHandle, recipientDid);
        const innerMessage = await crypto.authCrypt(walletHandle, senderVk, recipientVk, message.message);
        return module.exports.sendAnoncrypt(
            pairwiseInfo.metadata.theirEndpointVk,
            pairwiseInfo.metadata.theirEndpoint,
            Object.assign({}, message, { message: innerMessage })
        );
    },

    /**
     * Decrypt authcrypted message from senderDid
     * @param {number} walletHandle
     * @param {string} senderDid
     * @param {string} message authcrypted message
     * @return {Promise<object>} decrypted and parsed message object
     */
    async authdecrypt(walletHandle, senderDid, message) {
        const pairwiseInfo = await pairwise.retrieve(walletHandle, senderDid);
        const recipientVk = await sdk.keyForLocalDid(walletHandle, pairwiseInfo['my_did']);
        return crypto.authDecryptJSON(walletHandle, recipientVk, message);
    }
};
