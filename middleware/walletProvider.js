/**
 * IDChain Agent REST API
 * Wallet Provider Middleware
 */
'use strict';

const log = require('../log').log;
const APIResult = require('../api-result');
const { wrap, wrapEx } = require('../asyncwrap');
const Wallet = require('../models/wallet');

const cache = {};

module.exports = {
    before: wrap(async (req, res, next) => {
        log.debug('walletProvider before');
        let walletId = req.body.wallet || req.params.wallet || req.header('wallet') || (req.user && req.user.wallet);
        if (!walletId || !req.user) {
            return next();
        }
        if (walletId === 'default') {
            if (!req.user.wallet) {
                throw APIResult.badRequest('could not retrieve default wallet for user');
            }
            walletId = req.user.wallet;
        }
        const wallet = await Wallet.findById(walletId).exec();
        if (!wallet || !wallet.usableBy(req.user)) {
            throw APIResult.notFound('no usable wallet found');
        }
        req.wallet = await module.exports.provideHandle(wallet);
        next();
    }),

    after: [
        wrap(async (req, res, next) => {
            log.debug('walletProvider after');
            if (req.wallet) await module.exports.returnHandle(req.wallet);
            next();
        }),
        wrapEx(async (error, req, res, next) => {
            log.debug('walletProvider after error');
            if (req.wallet) await module.exports.returnHandle(req.wallet);
            next(error);
        })
    ],

    async provideHandle(wallet, retries = 0) {
        const name = wallet.id;
        if (cache[name]) {
            if (cache[name].loading) {
                log.debug('wallet cache is loading %s, awaiting promise', name);
                cache[name].handle = await cache[name].promise;
                log.debug('promise resolved, cached handle ', name, cache[name].handle);
            }
            log.debug('wallet cache hit', name, cache[name]);
            cache[name].counter += 1;
            wallet.handle = cache[name].handle;
        } else {
            log.debug('wallet cache miss ', name, cache);
            try {
                cache[name] = { counter: 1, loading: true, promise: wallet.open() };
                cache[name].handle = await cache[name].promise;
            } catch (err) {
                delete cache[name];
                log.warn('wallet provider failed to open wallet', wallet, err);
                throw err;
            }
            cache[name].loading = false;
        }
        return wallet;
    },

    async isCached(wallet) {
        return cache[wallet.id] && cache[wallet.id].counter > 0;
    },

    async returnHandle(wallet) {
        log.debug('walletProvider return handle');
        const name = wallet.id;
        if (!cache[name]) {
            log.debug('walletProvider return Handle cache miss', name);
            return;
        }
        const isDeleted = wallet.isDeleted ? wallet.isDeleted() : false;
        cache[name].counter -= 1;
        if (cache[name].counter <= 0 || isDeleted) {
            delete cache[name];
            await wallet.close();
        }
    }
};
