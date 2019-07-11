/**
 * IDChain Agent REST API
 * Wallet Connections Controller
 */
'use strict';

const lib = require('../../lib');
const ConnectionService = require('../../services').ConnectionService;

module.exports = {
    /**
     * List pairwises stored in wallet
     * @param {Wallet} wallet
     * @return {Promise<object[]>}
     */
    async list(wallet) {
        return (await ConnectionService.find(wallet)).map(v => {
            return {
                my_did: v.myDid,
                their_did: v.theirDid,
                acknowledged: v.state === lib.connection.STATE.COMPLETE
            };
        });
    },

    /**
     * Retrieve pairwise stored in wallet by id
     * @param {Wallet} wallet
     * @param {string} id
     */
    async retrieve(wallet, id) {
        const connection = await ConnectionService.findOne(wallet, { theirDid: id });
        if (!connection) {
            return;
        }
        return {
            my_did: connection.myDid,
            their_did: connection.theirDid,
            acknowledged: connection.state === lib.connection.STATE.COMPLETE
        };
    }
};
