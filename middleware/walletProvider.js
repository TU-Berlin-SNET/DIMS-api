/**
 * IDChain Agent REST API
 * Wallet Provider Middleware
 */

const { wrap, wrapEx } = require('../asyncwrap');
const log = require('../log').log;
const APIResult = require('../api-result');
const Wallet = require('../models/wallet');

const cache = {};

/**
 * Finds and opens the wallet with walletId of user
 * and provides it through req.wallet for further
 * processing
 * @param {Object} req request object
 * @param {String} walletId wallet name
 * @return {Object} the wallet object
 */
async function provideWallet(req, walletId) {
    log.info('providing wallet with walletId %s for user %s', walletId, req.user.username);
    const w = await Wallet.findOne({
        _id: walletId,
        owner: req.user
    }).exec();
    if (!w) throw new APIResult(404, { message: 'Wallet not found' });
    await module.exports.provideHandle(w);
    req.wallet = w;
    return w;
}

module.exports = {
    before: wrap(async (req, res, next) => {
        log.debug('walletProvider before');
        const walletId = req.body.wallet || req.params.wallet || req.header('wallet');
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

    async provideHandle(wallet) {
        const name = wallet.id;
        if (cache[name] && cache[name].counter > 0 && cache[name].handle) {
            log.debug('wallet cache hit', wallet.id, cache);
            cache[name].counter += 1;
            wallet.handle = cache[name].handle;
        } else {
            log.debug('wallet cache miss ', wallet.id, cache);
            cache[name] = { counter: 1, handle: await wallet.open() };
        }
        return wallet;
    },

    async returnHandle(wallet) {
        log.debug('walletProvider return handle');
        const name = wallet.id;
        if (!cache[name] || cache[name].counter <= 1) {
            delete cache[name];
            await wallet.close();
        }
        return;
    }
};
