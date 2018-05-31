
const indy = require('indy-sdk');

const wrap = require('../asyncwrap').wrap;
const log = require('../log').log;
const APIResult = require('../api-result');
const Wallet = require('../models/wallet');

module.exports = {

  list: wrap(async (req, res, next) => {
    log.debug('walletController list');
    const w = await Wallet.find({owner: req.user}).exec();
    next(new APIResult(200, w));
  }),

  create: wrap(async (req, res, next) => {
    log.debug('walletController create');
    const data = req.body;
    let doc = {};
    if (data.name) doc._id = data.name;
    if (data.xtype) doc.xtype = data.xtype;
    if (data.config) doc.config = data.config;
    if (data.credentials) doc.credentials = data.credentials;
    doc.poolName = data.poolName || process.env.POOL_NAME;
    doc.owner = req.user;

    let w = new Wallet(doc);
    await indy.createWallet(w.poolName, w._id, w.xtype, w.config, w.credentials);
    const handle = await indy.openWallet(w._id, w.config, w.credentials);
    try {
      const didJSON = (data.seed) ? {seed: data.seed} : {};
      const [did] = await indy.createAndStoreMyDid(handle, didJSON);
      w.issuerDid = did;
    } finally {
      if (handle !== -1) await indy.closeWallet(handle);
    }
    w = await w.save();
    next(new APIResult(201, w));
  }),

  retrieve: wrap(async (req, res, next) => {
    log.debug('walletController retrieve');
    let w = req.wallet.toObject();
    w.dids = await indy.listMyDidsWithMeta(req.wallet.handle);
    w.pairwise = await indy.listPairwise(req.wallet.handle);
    next(new APIResult(200, w));
  }),

  delete: wrap(async (req, res, next) => {
    log.debug('walletController delete');
    await req.wallet.remove();
    delete req.wallet;
    next(new APIResult(204));
  }),

};
