const indy = require('indy-sdk');

const wrap = require('../asyncwrap').wrap;
const APIResult = require('../api-result');
const Wallet = require('../models/wallet');

module.exports = {
    list: wrap(async (req, res, next) => {
        const w = await Wallet.find({ owner: req.user }).exec();
        next(new APIResult(200, w.map(v => v.toMinObject())));
    }),

    create: wrap(async (req, res, next) => {
        const data = req.body;
        let doc = {};
        if (data.name) doc._id = data.name;
        if (data.xtype) doc.xtype = data.xtype;
        if (data.config) doc.config = data.config;
        if (data.credentials) doc.credentials = data.credentials;
        doc.poolName = data.poolName || process.env.POOL_NAME;
        doc.owner = req.user._id;

        let w = new Wallet(doc);
        let handle = -1;
        try {
            await indy.createWallet(w.poolName, w._id, w.xtype, w.config, w.credentials);
            handle = await indy.openWallet(w._id, w.config, w.credentials);
            const didJSON = data.seed ? { seed: data.seed } : {};
            const [did] = await indy.createAndStoreMyDid(handle, didJSON);
            w.ownDid = did;
        } catch (err) {
            if (err.indyCode && err.indyCode === 203) {
                return next(new APIResult(400, { message: 'wallet already exists' }));
            } else {
                return next(new APIResult(500, { message: 'internal server error' }, err));
            }
        } finally {
            if (handle !== -1) await indy.closeWallet(handle);
        }
        w = await w.save();
        next(new APIResult(201, w.toMinObject()));
    }),

    retrieve: wrap(async (req, res, next) => {
        let w = req.wallet.toMinObject();
        w.dids = await indy.listMyDidsWithMeta(req.wallet.handle);
        w.pairwise = await indy.listPairwise(req.wallet.handle);
        next(new APIResult(200, w));
    }),

    delete: wrap(async (req, res, next) => {
        await req.wallet.remove();
        delete req.wallet;
        next(new APIResult(204));
    })
};
