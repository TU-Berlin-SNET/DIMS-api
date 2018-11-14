/**
 * IDChain Agent REST API
 * Wallet Controller
 */
'use strict';

const lib = require('../../lib');
const log = require('../../log').log;
const Mongoose = require('../../db');
const APIResult = require('../../api-result');

const Wallet = Mongoose.model('Wallet');

module.exports = {
    /**
     * List Wallets which belong to user
     * or which user is allowed to use
     * @param {User} user
     * @return {Promise<Wallet[]>}
     */
    async list(user) {
        return Wallet.find({
            $or: [
                {
                    owner: user._id
                },
                {
                    users: user._id
                }
            ]
        }).exec();
    },

    /**
     * Create a wallet and if user had
     * no previous default wallet, set as default
     * @param {User} user
     * @param {string} [name]
     * @param {string} credentials
     * @param {string} [seed]
     * @return {Promise<Wallet>}
     */
    async create(user, name, credentials, seed) {
        if (name === 'default') {
            throw APIResult.badRequest('invalid wallet name default');
        }
        let wallet = new Wallet({
            _id: name,
            owner: user._id,
            credentials: credentials
        });

        try {
            await lib.sdk.createWallet(wallet.config, wallet.credentials);
            await wallet.open();
            const didJSON = seed ? { seed: seed } : {};
            const [did] = await lib.sdk.createAndStoreMyDid(wallet.handle, didJSON);
            wallet.ownDid = did;
            const masterSecretId = await lib.sdk.proverCreateMasterSecret(wallet.handle);
            await lib.did.setDidMetaJSON(wallet.handle, wallet.ownDid, {
                primary: true,
                masterSecretId: masterSecretId
            });
            wallet = await wallet.save();
        } catch (err) {
            log.warn('walletController createWallet error');
            log.warn(err);
            // 11000 = duplicate key error, i.e. generated ownDid is already in use
            // if the wallet-name was already taken then indy-sdk would have thrown
            // so it is safe to remove the wallet here
            if (err.name === 'MongoError' && err.code === 11000) {
                await wallet.remove();
                throw APIResult.badRequest(err.message);
            }
            throw err;
        } finally {
            await wallet.close();
        }

        if (!user.wallet) {
            user.wallet = wallet._id;
            await user.save();
        }

        return wallet;
    },

    /**
     * Retrieve wallet as object with additional info
     * (like dids, did metadata, and pairwises)
     * @param {Wallet} wallet
     */
    async getPopulated(wallet) {
        const walletObj = wallet.toMinObject();
        walletObj.dids = await lib.sdk.listMyDidsWithMeta(wallet.handle);
        walletObj.pairwise = await lib.sdk.listPairwise(wallet.handle);
        return walletObj;
    }
};
