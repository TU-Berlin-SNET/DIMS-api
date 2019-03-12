/**
 * IDChain Agent REST API
 * Wallet Connections Controller
 */
'use strict';

const lib = require('../../lib');

module.exports = {
    /**
     * List pairwises stored in wallet
     * @param {Wallet} wallet
     * @return {Promise<object[]>}
     */
    async list(wallet) {
        return lib.pairwise.list(wallet.handle);
    },

    /**
     * Retrieve pairwise stored in wallet by id
     * @param {Wallet} wallet
     * @param {string} id
     */
    async retrieve(wallet, id) {
        return lib.pairwise.retrieve(wallet.handle, id);
    }
};
