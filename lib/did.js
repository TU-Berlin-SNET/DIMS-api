const indy = require('indy-sdk');

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
            verkey = await indy.keyForDid(ledger.handle, walletHandle, did);
        }
        // if their endpoint is neither in the offer not in the body
        if (!endpoint) {
            // it must be on the ledger!
            [endpoint] = await indy.getEndpointForDid(walletHandle, ledger.handle, did);
        }
        return [did, verkey, endpoint];
    }
};
