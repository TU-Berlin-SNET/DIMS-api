const lib = require('../lib');
const wrap = require('../asyncwrap').wrap;
const APIResult = require('../api-result');
const Wallet = require('../models/wallet');
const log = require('../log').log;

module.exports = {
    list: wrap(async (req, res, next) => {
        const w = await Wallet.find({
            $or: [
                {
                    owner: req.user._id
                },
                {
                    users: req.user._id
                }
            ]
        }).exec();
        // FIXME replace with mongoose select call
        next(APIResult.created(w.map(v => v.toMinObject())));
    }),

    create: wrap(async (req, res, next) => {
        const data = req.body;
        const wallet = await module.exports.createWallet(data, req.user);
        // if user has no default wallet set yet, set it
        if (!req.user.wallet) {
            req.user.wallet = wallet._id;
            await req.user.save();
        }
        next(APIResult.created(wallet.toMinObject()));
    }),

    retrieve: wrap(async (req, res, next) => {
        let w = req.wallet.toMinObject();
        w.dids = await lib.sdk.listMyDidsWithMeta(req.wallet.handle);
        w.pairwise = await lib.sdk.listPairwise(req.wallet.handle);
        next(APIResult.success(w));
    }),

    delete: wrap(async (req, res, next) => {
        req.wallet = await req.wallet.remove();
        next(APIResult.noContent());
    }),

    async createWallet(data, user) {
        if (data.name === 'default') {
            throw APIResult.badRequest('sorry, wallet name default is reserved');
        }

        let wallet = new Wallet({
            _id: data.name,
            owner: user._id,
            credentials: data.credentials
        });
        let handle = -1;

        try {
            await lib.sdk.createWallet(wallet.config, wallet.credentials);
            handle = await lib.sdk.openWallet(wallet.config, wallet.credentials);
            const didJSON = data.seed ? { seed: data.seed } : {};
            const [did] = await lib.sdk.createAndStoreMyDid(handle, didJSON);
            wallet.ownDid = did;
        } catch (err) {
            log.warn('walletController createWallet error');
            log.warn(err);
            if (err.indyCode && err.indyCode === 203) {
                throw APIResult.badRequest('wallet already exists');
            } else {
                throw err;
            }
        } finally {
            if (handle !== -1) await lib.sdk.closeWallet(handle);
        }
        wallet = await wallet.save();
        return wallet;
    }
};
