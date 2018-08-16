const indy = require('indy-sdk');
const message = require('./indy-message');
const nonce = require('../nonce');

const appEndpoint = process.env.APP_ENDPOINT;

module.exports = {
    /**
     * Create a connection offer and return it
     * @param {Wallet} wallet
     * @param {PoolLedger} pool
     * @param {String} endpoint
     * @return {Object} connection offer
     */
    async createConnectionOffer(wallet, pool, endpoint = appEndpoint) {
        const [did, vkey] = await indy.createAndStoreMyDid(wallet.handle, {});
        await pool.nymRequest(wallet.handle, wallet.ownDid, did, vkey);
        await pool.attribRequest(
            wallet.handle,
            did,
            did,
            null,
            {
                endpoint: {
                    ha: endpoint,
                    verkey: vkey
                }
            },
            null
        );
        const offerNonce = nonce.uuidv4hex();
        return {
            id: offerNonce,
            type: message.messageTypes.CONNECTIONOFFER,
            message: {
                did: did,
                endpointDid: wallet.ownDid,
                nonce: offerNonce
            }
        };
    }
};
