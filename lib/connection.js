const indy = require('indy-sdk');
const message = require('./indy-message');
const ConnectionOffer = require('../models/connectionoffer');

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
        await pool.nymRequest(wallet.handle, wallet.primaryDid, did, vkey);
        await pool.attribRequest(
            wallet.handle,
            wallet.primaryDid,
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
        const offer = await new ConnectionOffer({
            wallet: wallet,
            did: did
        }).save();
        return {
            id: offer.id,
            type: message.messageTypes.CONNECTIONOFFER,
            message: {
                did: offer.did,
                endpointDid: endpointDid,
                nonce: offer.nonce
            }
        };
    }
};
