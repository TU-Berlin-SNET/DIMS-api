/**
 * Wrapper to be used for express async middleware or routes
 * @param {*} fn
 */

module.exports = (fn) => (req, res, next) => fn(req, res, next).catch(next);
