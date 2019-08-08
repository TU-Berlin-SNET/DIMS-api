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
        return totalCount > 0 ? await lib.sdk.proverFetchCredentials(searchHandle, totalCount) : [];
    },

    /**
     * Retrieve credential stored in wallet by id
     * @param {Wallet} wallet
     * @param {string} credentialId
     */
    async retrieve(wallet, credentialId) {
        return await lib.sdk.proverGetCredential(wallet.handle, credentialId);
    }
};
