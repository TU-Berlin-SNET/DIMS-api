
const User = require('../models/user');
const wrap = require('../asyncwrap');

module.exports = {

  create: wrap(async (req, res, next) => {
    const userExists = await User.count({username: req.body.username}).exec() > 0;
    if (userExists) return next({status: 400, message: 'username already taken'});
    let u = new User({username: req.body.username, password: req.body.password});
    u = await u.save();
    return res.status(201).set('location', '/users/'+u._id).end();
  }),

  retrieve: wrap(async (req, res, next) => {
    // TODO return user's wallets, too
    if (req.user.id === req.params.id) {
      return res.status(200).set('content-type', 'application/json').send(req.user);
    }
    next();
  }),

  update: wrap(async (req, res, next) => {
    next({message: 'Not yet implemented', status: 501});
  }),

  delete: wrap(async (req, res, next) => {
    next({message: 'Not yet implemented', status: 501});
  }),

};
