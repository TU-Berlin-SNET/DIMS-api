/**
 * Indy Messages
 */
'use strict';

const agent = require('superagent');
const crypto = require('./crypto');

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
        PROOF: 'urn:sovrin:agent:message_type:sovrin.org/proof'
    },

    /**
     * Send message to endpoint
     * @param {string} endpoint
     * @param {string} message
     * @return {SuperAgentRequest}
     */
    sendMessage(endpoint, message) {
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
    async sendAnoncryptMessage(recipientVk, endpoint, message) {
        const cryptFn = typeof message === 'object' ? crypto.anonCryptJSON : crypto.anonCrypt;
        return module.exports.sendMessage(endpoint, await cryptFn(recipientVk, message));
    }
};
