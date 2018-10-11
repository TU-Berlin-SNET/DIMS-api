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
        const pairwises = (await lib.sdk.listPairwise(wallet.handle)).filter(v => v['my_did'] === myDid);
        if (pairwises.length === 0) {
            return null;
        }
        const pairwise = pairwises[0];
        pairwise.metadata = pairwise.metadata ? JSON.parse(pairwise.metadata) : {};
        return pairwise;
    }
};
