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
        next(APIResult.success(w.map(v => v.toMinObject())));
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

        try {
            await lib.sdk.createWallet(wallet.config, wallet.credentials);
            await wallet.open();
            const didJSON = data.seed ? { seed: data.seed } : {};
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
        return wallet;
    }
};
