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
        return await lib.pairwise.find(wallet.handle, myDid);
    }
};
