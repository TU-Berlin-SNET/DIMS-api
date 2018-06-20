
const APIResult = require('../api-result');
const User = require('../models/user');
const wrap = require('../asyncwrap').wrap;
const log = require('../log').log;

/**
 * Check if user is the same as requesting user
 * @param {object} user req.user
 * @param {string} resource req.params.user
 * @return {boolean}
 */
function isSame(user, resource) {
  return (resource === 'me' || resource === user.id);
}

const notFoundResult = new APIResult(404, {message: 'user not found'});

module.exports = {

  create: wrap(async (req, res, next) => {
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
    if (!isSame(req.user, req.params.user)) {
      return next(notFoundResult);
    }
    next(new APIResult(200, {id: req.user.id, username: req.user.username}));
  }),

  update: wrap(async (req, res, next) => {
    if (!isSame(req.user, req.params.user)) {
      return next(notFoundResult);
    }
    if (!req.body.username && !req.body.password) {
      return next(new APIResult(400, {message: 'no values to update provided, either username or password must be present'}));
    }
    if (req.body.username) req.user.username = req.body.username;
    if (req.body.password) req.user.password = req.body.password;
    try {
      req.user = await req.user.save();
    } catch (err) {
      log.warn(err);
      return next(new APIResult(400, {message: 'username already taken'}));
    }
    next(new APIResult(200));
  }),

  delete: wrap(async (req, res, next) => {
    if (!isSame(req.user, req.params.user)) {
      return next(notFoundResult);
    }
    await req.user.remove();
    next(new APIResult(204));
  }),

};
