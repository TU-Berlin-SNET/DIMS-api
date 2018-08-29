/**
 * IDChain Agent REST API
 * Wallet Provider Middleware
 */

const log = require('../log').log;
const APIResult = require('../api-result');
const { wrap, wrapEx } = require('../asyncwrap');
const Wallet = require('../models/wallet');

const RETRY_TIMEOUT = process.env.WALLETCACHE_WAIT_TIME;
const MAX_RETRIES = process.env.WALLETCACHE_MAX_RETRIES;

const cache = {};

/**
 * Finds and opens the wallet with walletId, checks
 * if logged in user is allowed to use it, and provides
 * it through req.wallet for further processing
 * @param {Object} req request object
 * @param {String} walletId wallet name
 * @return {Object} the wallet object
 */
async function provideWallet(req, walletId) {
    log.info('providing wallet with walletId %s for user %s', walletId, req.user.username);
    if (!walletId) {
        throw APIResult.badRequest('no default wallet set for user and wallet parameter missing');
    }
    if (walletId === 'default') {
        walletId = req.user.wallet;
    }
    const w = await Wallet.findById(walletId).exec();
    if (!w || !w.usableBy(req.user)) {
        throw APIResult.notFound('no suitable wallet found');
    }
    await module.exports.provideHandle(w);
    req.wallet = w;
    return w;
}

module.exports = {
    before: wrap(async (req, res, next) => {
        log.debug('walletProvider before');
        const walletId = req.body.wallet || req.params.wallet || req.header('wallet') || req.user.wallet;
        if (!walletId || !req.user) return next();
        await provideWallet(req, walletId);
        next();
    }),

    param: wrapEx(async (req, res, next, walletId) => {
        log.debug('walletProvider param');
        await provideWallet(req, walletId);
        next();
    }),

    after: [
        wrap(async (req, res, next) => {
            log.debug('walletProvider after');
            if (req.wallet) await module.exports.returnHandle(req.wallet);
            next();
        }),
        wrapEx(async (result, req, res, next) => {
            log.debug('walletProvider after result-handler');
            if (req.wallet) await module.exports.returnHandle(req.wallet);
            next(result);
        })
    ],

    async provideHandle(wallet, retries = 0) {
        const name = wallet.id;
        if (retries > MAX_RETRIES) {
            throw new Error('Failed to open Wallet. Please try again.');
        }
        if (cache[name] && cache[name].counter > 0) {
            if (cache[name].loading) {
                log.debug('wallet cache is loading', wallet.id, cache);
                await new Promise(resolve => setTimeout(resolve, RETRY_TIMEOUT));
                return await module.exports.provideHandle(wallet, ++retries);
            }
            log.debug('wallet cache hit', wallet.id, cache);
            cache[name].counter += 1;
            wallet.handle = cache[name].handle;
        } else {
            log.debug('wallet cache miss ', wallet.id, cache);
            cache[name] = { counter: 1, loading: true };
            try {
                cache[name].handle = await wallet.open();
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
            log.debug('walletProvider return Handle cache miss');
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
