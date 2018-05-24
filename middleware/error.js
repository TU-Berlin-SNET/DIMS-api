
const log = require('../log').log;

module.exports = (err, req, res, next) => {
  log.error(err);
  if (err instanceof SyntaxError) return res.status(400).send(err.message);
  return res.status(err.status || 500).send(err.message);
};
