
const log = require('../log').log;

module.exports = (err, req, res, next) => {
  log.error(err);
  if (err.stack) log.error(err.stack);
  return res.status(err.status || 500).send(err.message);
};
