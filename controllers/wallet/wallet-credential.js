/**
 * IDChain Agent REST API
 * Wallet Credentials Controller
 */
'use strict';

const lib = require('../../lib');

module.exports = {
    /**
     * List Credentials stored in wallet
     * @param {Wallet} wallet
     * @param {object} [query]
     * @return {Promise<object[]>}
     */
    async list(wallet, query = {}) {
        const [searchHandle, totalCount] = await lib.sdk.proverSearchCredentials(wallet.handle, query);
        return lib.sdk.proverFetchCredentials(searchHandle, totalCount);
    },

    /**
     * Retrieve credential stored in wallet by id
     * @param {Wallet} wallet
     * @param {string} credentialId
     */
    async retrieve(wallet, credentialId) {
        return lib.sdk.proverGetCredential(wallet.handle, credentialId);
    }
};
