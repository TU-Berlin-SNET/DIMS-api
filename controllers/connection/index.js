const lib = require('../../lib');

module.exports = {
    offer: require('./offer'),
    request: require('./request'),
    response: require('./response'),
    acknowledgement: require('./acknowledgement'),

    /**
     * Retrieve connection record + status from pairwise if available,
     * which together represent connection state
     * @param {Wallet} wallet
     * @param {string} myDid
     * @return {Promise<object>} meta
     */
    async retrieve(wallet, myDid) {
        const record = await lib.record.getWalletRecordJSON(wallet.handle, lib.record.types.connection, myDid);
        let result = null;

        if (record) {
            if (record.theirDid && (await lib.sdk.isPairwiseExists(wallet.handle, record.theirDid))) {
                const pairwise = await lib.pairwise.getPairwise(wallet.handle, record.theirDid);
                result = {
                    theirDid: record.theirDid,
                    acknowledged: pairwise.metadata.acknowledged
                };
            } else {
                result = {
                    theirDid: record.theirDid || '',
                    acknowledged: false
                };
            }
        }

        return result;
    }
};
