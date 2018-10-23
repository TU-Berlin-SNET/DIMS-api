const crypto = require('crypto');
const sdk = require('indy-sdk');

const message = require('./indy-message');

module.exports = {
    /**
     * Encode a value as required by indy, i.e.
     * toString numbers and process strings.
     * @param {any} value value to encode
     * @return {string} encoded value
     */
    encode(value) {
        if (typeof value === 'number') {
            return value.toString();
        } else {
            return Buffer.from(crypto.createHmac('sha256', value).digest('hex'), 'utf-8').toString('hex');
        }
    },

    /**
     * Create a credential offer and return it
     * @param {number} walletHandle
     * @param {string} credDefId
     * @param {string} recipientDid
     * @return {Promise<Object>} credential offer - not encrypted
     */
    async createCredentialOffer(walletHandle, credDefId, recipientDid) {
        const pairwise = await sdk.getPairwise(walletHandle, recipientDid);
        const innerMessage = await sdk.issuerCreateCredentialOffer(walletHandle, credDefId);
        return {
            id: innerMessage.nonce,
            origin: pairwise['my_did'],
            type: message.messageTypes.CREDENTIALOFFER,
            message: innerMessage
        };
    },

    async createCredentialRequest(walletHandle, senderDid, credentialOffer, credentialDefinition, masterSecretId) {
        const [innerMessage, meta] = await sdk.proverCreateCredentialReq(
            walletHandle,
            senderDid,
            credentialOffer,
            credentialDefinition,
            masterSecretId
        );
        const request = {
            id: credentialOffer.nonce,
            origin: senderDid,
            type: message.messageTypes.CREDENTIALREQUEST,
            message: innerMessage
        };
        return [request, meta];
    }
};
