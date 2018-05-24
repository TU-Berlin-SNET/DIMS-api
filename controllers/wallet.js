
const indy = require('indy-sdk');

const wrap = require('../asyncwrap');
const log = require('../log').log;
const Wallet = require('../models/wallet');

module.exports = {

  list: wrap(async (req, res, next) => {
    const w = await Wallet.find({owner: req.user}).exec();
    return res.status(200).send(w);
  }),

  create: wrap(async (req, res, next) => {
    const data = req.body;
    let doc = {};
    if (data.name) doc._id = data.name;
    if (data.xtype) doc.xtype = data.xtype;
    if (data.config) doc.config = data.config;
    if (data.credentials) doc.credentials = data.credentials;
    if (data.seed) doc.seed = data.seed;
    doc.poolName = data.poolName || process.env.POOL_NAME;
    doc.owner = req.user;

    let w = new Wallet(doc);
    await indy.createWallet(w.poolName, w._id, w.xtype, w.config, w.credentials);
    const handle = await indy.openWallet(w._id, w.config, w.credentials);
    try {
      const didJSON = (w.seed) ? {seed: w.seed} : {};
      const [did] = await indy.createAndStoreMyDid(handle, didJSON);
      w.issueDid = did;
    } finally {
      if (handle !== -1) await indy.closeWallet(handle);
    }
    w = await w.save();
    return res.status(201).send(w);
  }),

  retrieve: wrap(async (req, res, next) => {
    let w = await Wallet.findById(req.params.id).exec();
    let handle = -1;
    try {
      handle = await indy.openWallet(w._id, w.config, w.credentials);
      w = w.toObject();
      w.dids = await indy.listMyDidsWithMeta(handle);
      w.pairwise = await indy.listPairwise(handle);
      return res.status(200).set('content-type', 'application/json').send(w);
    } finally {
      if (handle !== -1) {
        await indy.closeWallet(handle);
      }
    }
  }),

  delete: wrap(async (req, res, next) => {
    // FIXME Wallet.remove will not trigger remove middleware hook
    // use Wallet.findById followed by remove
    await Wallet.remove({_id: req.params.id});
    return res.status(204).end();
  }),

};
