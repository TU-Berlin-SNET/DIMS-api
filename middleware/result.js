/**
 * IDChain Agent REST API
 * Result Handler
 */

const log = require('../log').log;

module.exports = {
  resultMiddleware: (result, req, res, next) => {
    log.debug('result middleware');
    log.info(result);
    if (result instanceof Error) return next(result);
    if (result.error) return next(result.error);
    if (result.status) res.status(result.status);
    if (result.data) res.json(result.data);
    res.end();
  },
  errorMiddleware: (err, req, res, next) => {
    log.debug('error middleware');
    log.error(err);
    if (err.stack) log.error(err.stack);
    return res.status(err.status || 500).json({message: err.message});
  },
};
