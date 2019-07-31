const logger = require('../log');
const middleware = require('express-pino-logger');

module.exports = middleware({ logger });
