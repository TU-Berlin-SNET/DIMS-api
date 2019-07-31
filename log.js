/**
 * IDChain Agent Logger
 */

const log = require('pino')({ level: process.env.IDC_API_LOG_LEVEL || 'info' });

module.exports = log;
