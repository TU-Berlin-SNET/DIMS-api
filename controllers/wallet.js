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
        let doc = {};
        if (data.name) doc._id = data.name;
        if (data.xtype) doc.xtype = data.xtype;
        if (data.config) doc.config = data.config;
        if (data.credentials) doc.credentials = data.credentials;
        doc.poolName = data.poolName || process.env.POOL_NAME;
        doc.owner = user._id;

        if (doc._id === 'default') {
            throw APIResult.badRequest('sorry, the name default is reserved');
        }

        let w = new Wallet(doc);
        let handle = -1;
        try {
            await indy.createWallet(w.poolName, w._id, w.xtype, w.config, w.credentials);
            handle = await indy.openWallet(w._id, w.config, w.credentials);
            const didJSON = data.seed ? { seed: data.seed } : {};
            const [did] = await indy.createAndStoreMyDid(handle, didJSON);
            w.ownDid = did;
        } catch (err) {
            log.warn('walletController createWallet error', err);
            if (err.indyCode && err.indyCode === 203) {
                throw APIResult.badRequest('wallet already exists');
            } else {
                throw err;
            }
        } finally {
            if (handle !== -1) await indy.closeWallet(handle);
        }
        w = await w.save();
        return w;
    }
};
