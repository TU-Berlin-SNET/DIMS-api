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
        const pairwise = await lib.sdk.listPairwise(wallet.handle);
        return pairwise.map(v => {
            v.metadata = v.metadata ? JSON.parse(v.metadata) : {};
            return v;
        });
    },

    /**
     * Retrieve pairwise stored in wallet by id
     * @param {Wallet} wallet
     * @param {string} id
     */
    async retrieve(wallet, id) {
        const pairwise = await lib.pairwise.getPairwise(wallet.handle, id);
        if (pairwise) {
            // indy-sdk does not return their_did when pairwise
            // is retrieved using their_did
            // add it to the object to keep output consistent
            pairwise['their_did'] = id;
        }
        return pairwise;
    }
};
