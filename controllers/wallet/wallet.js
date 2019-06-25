/**
 * IDChain Agent REST API
 * Wallet Controller
 */
'use strict';

const lib = require('../../lib');
const log = require('../../log').log;
const Mongoose = require('../../db');
const APIResult = require('../../util/api-result');
const WalletProvider = require('../../middleware/walletProvider');

const Wallet = Mongoose.model('Wallet');
const Routing = Mongoose.model('Routing');

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
            await wallet.create({ seed });
            wallet = await wallet.save();
            // create new routing entry
            await new Routing({
                _id: await lib.did.localKeyOf(wallet, wallet.ownDid),
                wallet: wallet
            }).save();
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
     * @param {User} user
     * @param {string} walletId id
     */
    async retrieveInfo(user, walletId) {
        let result = null;
        let wallet = await Wallet.findById(walletId).exec();
        if (!wallet || !wallet.usableBy(user)) {
            return result;
        }

        wallet = await WalletProvider.provideHandle(wallet);
        try {
            result = wallet.toJSON();
            result.dids = await lib.sdk.listMyDidsWithMeta(wallet.handle);
            result.pairwise = await lib.pairwise.list(wallet.handle);
        } finally {
            await WalletProvider.returnHandle(wallet);
        }

        return result;
    }
};
