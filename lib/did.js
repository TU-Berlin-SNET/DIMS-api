const sdk = require('indy-sdk');

module.exports = {
    /**
     * Ensure Did Info, i.e. fetch from ledger if not present
     * @param {number} walletHandle
     * @param {PoolLedger} ledger
     * @param {String} did
     * @param {String} [verkey]
     * @param {String} [endpoint]
     * @return {Promise<String[]>} did, verkey, endpoint
     */
    async ensureDidInfo(walletHandle, ledger, did, verkey, endpoint) {
        if (!did) {
            const err = {
                error: {
                    status: 400,
                    message: 'did must be present'
                }
            };
            throw err;
        }
        // if the verkey is neither in the offer nor in the body
        if (!verkey) {
            // it must be on the ledger!
            verkey = await sdk.keyForDid(ledger.handle, walletHandle, did);
        }
        // if their endpoint is neither in the offer not in the body
        if (!endpoint) {
            // it must be on the ledger!
            [endpoint] = await sdk.getEndpointForDid(walletHandle, ledger.handle, did);
        }
        return [did, verkey, endpoint];
    },

    /**
     * Set did metadata to object
     * @param {number} walletHandle
     * @param {string} did
     * @param {object} meta
     * @return {Promise<void>}
     */
    async setDidMetaJSON(walletHandle, did, meta) {
        return sdk.setDidMetadata(walletHandle, did, JSON.stringify(meta));
    },

    /**
     * Get did metadata as object
     * @param {number} walletHandle
     * @param {string} did
     * @return {Promise<object>}
     */
    async getDidMetaJSON(walletHandle, did) {
        return JSON.parse(await sdk.getDidMetadata(walletHandle, did));
    },

    /**
     * Get did metadata attribute
     * @param {number} walletHandle
     * @param {string} did
     * @param {string} attributeName
     * @return {Promise<Any>}
     */
    async getDidMetaAttribute(walletHandle, did, attributeName) {
        const meta = await module.exports.getDidMetaJSON(walletHandle, did);
        return meta[attributeName];
    },

    /**
     * Set did metadata attribute
     * @param {number} walletHandle
     * @param {string} did
     * @param {string} attributeName
     * @param {Any} attributeValue
     * @return {Promise<void>}
     */
    async setDidMetaAttribute(walletHandle, did, attributeName, attributeValue) {
        const meta = (await module.exports.getDidMetaJSON(walletHandle, did)) || {};
        meta[attributeName] = attributeValue;
        return module.exports.setDidMetaJSON(walletHandle, did, meta);
    }
};
