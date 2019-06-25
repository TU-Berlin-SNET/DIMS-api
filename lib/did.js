const sdk = require('indy-sdk');
const ledger = require('./ledger');
const log = require('./log');

module.exports = {
    /**
     * Ensure Did Info, i.e. fetch from ledger if not present
     * @param {number} walletHandle
     * @param {String} did
     * @param {String} [verkey]
     * @param {String} [endpoint]
     * @return {Promise<String[]>} did, verkey, endpoint
     */
    async ensureInfo(walletHandle, did, verkey, endpoint) {
        if (!did) {
            const err = {
                error: {
                    status: 400,
                    message: 'did must be present'
                }
            };
            throw err;
        }

        // try to retrieve the verkey from the ledger
        try {
            const vk = await sdk.keyForDid(ledger.handle, walletHandle, did);
            // the key is on the ledger, check if there is a mismatch between
            // provided key and key on the ledger
            if (verkey && vk !== verkey) {
                const err = {
                    error: {
                        status: 400,
                        message: 'verkey mismatch'
                    }
                };
                throw err;
            } else {
                // if no key was provided or there is no mismatch
                // use the key from the ledger
                verkey = vk;
            }
        } catch (err) {
            // if none was provided and it is NOT on the ledger or
            // could not be retrieved, throw
            if (!verkey) {
                throw err;
            }
        }

        // if no endpoint is provided
        if (!endpoint) {
            // it must be on the ledger!
            [endpoint] = await sdk.getEndpointForDid(walletHandle, ledger.handle, did);
        }

        return [did, verkey, endpoint];
    },

    /**
     * Create and store my did
     * @param {number} walletHandle
     * @param {object} options {seed}
     * @return {Promise<Array>} [did, vk]
     */
    async create(walletHandle, options = {}) {
        const result = await sdk.createAndStoreMyDid(walletHandle, options);
        await module.exports.setMeta(walletHandle, result[0], {});
        return result;
    },

    /**
     * Retrieve did, verkey, and metadata for locally stored did
     * @param {Wallet} wallet
     * @param {string} did
     */
    async retrieve(wallet, did) {
        return {
            did,
            verkey: await sdk.keyForLocalDid(wallet.handle, did),
            metadata: await module.exports.getMeta(wallet.handle, did)
        };
    },

    /**
     * Retrieve local key for did
     * @param {Wallet} wallet
     * @param {did} did
     */
    async localKeyOf(wallet, did) {
        log.debug('retrieving local key of', wallet, did);
        return await sdk.keyForLocalDid(wallet.handle, did);
    },

    /**
     * Retrieve key for did
     * @param {Wallet} wallet
     * @param {string} did
     */
    async keyOf(wallet, did) {
        return await sdk.keyForDid(ledger.handle, wallet.handle, did);
    },

    /**
     * Retrieve endpoint for did
     * @param {Wallet} wallet
     * @param {string} did
     */
    async getEndpoint(wallet, did) {
        return await sdk.getEndpointForDid(wallet.handle, ledger.handle, did);
    },

    /**
     * Retrieve my did with metadata
     * @param {number} walletHandle
     * @param {string} did
     * @return {Promise<object>} did with metadata
     */
    async getMyDid(walletHandle, did) {
        const data = await sdk.getMyDidWithMeta(walletHandle, did);
        data.metadata = data.metadata ? JSON.parse(data.metadata) : {};
        return data;
    },

    /**
     * Set did metadata to object
     * @param {number} walletHandle
     * @param {string} did
     * @param {object} meta
     * @return {Promise<void>}
     */
    async setMeta(walletHandle, did, meta) {
        return await sdk.setDidMetadata(walletHandle, did, JSON.stringify(meta));
    },

    /**
     * Get did metadata as object
     * @param {number} walletHandle
     * @param {string} did
     * @return {Promise<object>}
     */
    async getMeta(walletHandle, did) {
        const meta = await sdk.getDidMetadata(walletHandle, did);
        return meta ? JSON.parse(meta) : {};
    },

    /**
     * Set did metadata attribute
     * @param {number} walletHandle
     * @param {string} did
     * @param {string} attributeName
     * @param {Any} attributeValue
     * @return {Promise<void>}
     */
    async setMetaAttribute(walletHandle, did, attributeName, attributeValue) {
        const meta = await module.exports.getMeta(walletHandle, did);
        meta[attributeName] = attributeValue;
        return await module.exports.setMeta(walletHandle, did, meta);
    },

    /**
     * Get did metadata attribute
     * @param {number} walletHandle
     * @param {string} did
     * @param {string} attributeName
     * @return {Promise<Any>}
     */
    async getMetaAttribute(walletHandle, did, attributeName) {
        const meta = await module.exports.getMeta(walletHandle, did);
        return meta[attributeName];
    }
};
