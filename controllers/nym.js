/**
 * IDChain Agent REST API
 * Nym Controller for sending and retrieving nym requests manually
 */

const pool = require('../pool');

module.exports = {
    /**
     * Retrieve a nym record for a did from the ledger
     * @param {Wallet} wallet
     * @param {string} did
     * @return {Promise<Object>}
     */
    async get(wallet, did) {
        const result = await pool.getNym(wallet.ownDid, did);
        result.result.data = JSON.parse(result.result.data);
        return result.result;
    },

    /**
     * Write a nym record to the ledger
     * @param {Wallet} wallet
     * @param {string} did
     * @param {string} verkey
     * @param {string} [alias]
     * @param {string} [role]
     * @return {Promise<Object>}
     */
    async post(wallet, did, verkey, alias, role) {
        const result = await pool.nymRequest(
            wallet.handle,
            wallet.ownDid,
            did,
            verkey,
            alias,
            // 'NONE' actually means nothing so catch it
            // if 'NONE' is included in the request
            // indy-sdk returns CommonInvalidStructure
            role === 'NONE' ? null : role
        );
        return result.result;
    }
};
