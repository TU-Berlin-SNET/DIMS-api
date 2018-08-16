const indy = require('indy-sdk');
const message = require('./indy-message');
const nonce = require('../nonce');

const appEndpoint = process.env.APP_ENDPOINT;

module.exports = {
    /**
     * Create a connection offer and return it
     * @param {Wallet} wallet
     * @param {String} endpoint
     * @return {Object} connection offer
     */
    async createConnectionOffer(wallet, endpoint = appEndpoint) {
        const did = wallet.ownDid;
        const vk = await indy.keyForLocalDid(wallet.handle, did);
        const offerNonce = nonce.uuidv4hex();
        return {
            id: offerNonce,
            type: message.messageTypes.CONNECTIONOFFER,
            message: {
                did: did,
                verkey: vk,
                endpoint: endpoint,
                nonce: offerNonce
            }
        };
    },

    /**
     * Create a connection response
     * @param {Wallet} wallet
     * @param {String} myDid my pairwise did
     * @param {String} myVk my pairwise verkey
     * @param {String} theirDid their pairwise did
     * @param {String} requestNonce
     * @return {Object} connection response (formatted object)
     */
    async createConnectionResponse(wallet, myDid, myVk, theirDid, requestNonce) {
        return {
            id: requestNonce,
            aud: theirDid,
            type: message.messageTypes.CONNECTIONRESPONSE,
            message: {
                did: myDid,
                verkey: myVk,
                nonce: requestNonce
            }
        };
    }
};
