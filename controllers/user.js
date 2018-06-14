
const APIResult = require('../api-result');
const User = require('../models/user');
const Wallet = require('../models/wallet');
const wrap = require('../asyncwrap').wrap;
const log = require('../log').log;

module.exports = {

  create: wrap(async (req, res, next) => {
    log.debug('userController: create called');
    const userExists = await User.count({username: req.body.username}).exec() > 0;
    if (userExists) {
      return next(new APIResult(400, {message: 'username already taken'}));
    }
    let u = new User({username: req.body.username, password: req.body.password});
    u = await u.save();
    res.set('location', '/user/'+u._id);
    next(new APIResult(201));
  }),

  retrieve: wrap(async (req, res, next) => {
    log.debug('userController: retrieve called');
    if (req.params.user !== 'me' && req.params.user !== req.user.id) {
      return next(new APIResult(404, {message: 'User not found'}));
    }
    const wallets = await Wallet.find({owner: req.user}).exec();
    const data = req.user.toObject();
    data.wallets = wallets;
    next(new APIResult(200, data));
  }),

  update: wrap(async (req, res, next) => {
    log.debug('userController: update called');
    next(new APIResult(501, {message: 'Not yet implemented'}));
  }),

  delete: wrap(async (req, res, next) => {
    log.debug('userController: delete called');
    next(new APIResult(501, {message: 'Not yet implemented'}));
  }),

};
