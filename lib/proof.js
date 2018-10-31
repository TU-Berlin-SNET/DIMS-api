const crypto = require('./crypto');
const pairwise = require('./pairwise');
const message = require('./indy-message');

module.exports = {
    /**
     * Create and return a proof request message
     * @param {number} walletHandle
     * @param {string} recipientDid
     * @param {object} proofRequest proof request object containing requested_attributes, requested_predicates, .. but not nonce etc.
     * @return {Promise<object>} proof request message object
     */
    async createProofRequest(walletHandle, recipientDid, proofRequest) {
        const pairwiseInfo = await pairwise.getPairwise(walletHandle, recipientDid);
        proofRequest.nonce = crypto.getNonce();
        return {
            id: proofRequest.nonce,
            type: message.messageTypes.PROOFREQUEST,
            origin: pairwiseInfo['my_did'],
            message: proofRequest
        };
    }
};
