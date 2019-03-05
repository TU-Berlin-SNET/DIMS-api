/**
 * IDChain Agent Logger
 */

const log = require('pino')({ level: process.env.IDC_API_LOG_LEVEL || 'info' });

const middleware = require('express-pino-logger')({
    logger: log
});

module.exports = { log, middleware };
