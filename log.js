/**
 * IDChain Agent Logger
 */

 const log = require('pino')();
 const middleware = require('express-pino-logger')({
   logger: log,
 });

 module.exports = {log, middleware};
