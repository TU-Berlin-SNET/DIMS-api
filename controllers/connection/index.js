const lib = require('../../lib');

module.exports = {
    offer: require('./offer'),
    request: require('./request'),
    response: require('./response'),
    acknowledgement: require('./acknowledgement'),

    /**
     * Filter pairwises with myDid and return first object
     * @param {Wallet} wallet
     * @param {string} myDid
     * @return {Promise<object>} pairwise or null
     */
    async retrieve(wallet, myDid) {
        const pairwises = await lib.sdk.listPairwise(wallet.handle);
        const index = pairwises.findIndex(v => v && v['my_did'] === myDid);
        if (index === -1) {
            return null;
        }
        const pairwise = pairwises[index];
        pairwise.metadata = pairwise.metadata ? JSON.parse(pairwise.metadata) : {};
        return pairwise;
    }
};
