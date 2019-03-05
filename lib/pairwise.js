const sdk = require('indy-sdk');

module.exports = {
    /**
     * List pairwises in wallet
     * @param {number} walletHandle
     * @return {Promise<Array>} pairwises
     */
    async list(walletHandle) {
        const pairwises = await sdk.listPairwise(walletHandle);
        pairwises.forEach(v => (v.metadata = v.metadata ? JSON.parse(v.metadata) : {}));
        return pairwises;
    },

    /**
     * Find first pairwise in wallet with myDid
     * @param {number} walletHandle
     * @param {string} myDid
     * @return {Promise<object>} pairwise
     */
    async find(walletHandle, myDid) {
        const pairwise = (await sdk.listPairwise(walletHandle)).find(v => v['my_did'] === myDid);
        if (pairwise) {
            pairwise.metadata = pairwise.metadata ? JSON.parse(pairwise.metadata) : {};
        }
        return pairwise;
    },

    /**
     * @param {number} walletHandle
     * @param {string} theirDid
     * @return {Promise<object>} pairwise object with parsed metadata
     */
    async retrieve(walletHandle, theirDid) {
        const pairwise = await sdk.getPairwise(walletHandle, theirDid);
        pairwise.metadata = pairwise.metadata ? JSON.parse(pairwise.metadata) : {};
        // indy-sdk does not return their_did when pairwise is retrieved using their_did
        // so add it to the object to keep output consistent
        pairwise['their_did'] = theirDid;
        return pairwise;
    },

    /**
     * Check if pairwise exists in wallet
     * @param {number} walletHandle
     * @param {string} theirDid
     * @return {Promise<boolean>}
     */
    async exists(walletHandle, theirDid) {
        return sdk.isPairwiseExists(walletHandle, theirDid);
    },

    /**
     * JSON.stringify data and set as pairwise metadata
     * @param {number} walletHandle
     * @param {string} theirDid
     * @param {object} data
     * @return {Promise<void>} resolves when metadata is set, rejects on error
     */
    async setMetadata(walletHandle, theirDid, data) {
        return sdk.setPairwiseMetadata(walletHandle, theirDid, JSON.stringify(data));
    }
};
