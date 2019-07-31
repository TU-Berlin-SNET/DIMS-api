const cors = require('cors');
const bodyParser = require('body-parser');

const validation = require('./validate');
const logMiddleware = require('./log');
const notFound = require('./404');
const { resultHandler, errorHandler } = require('./result');

module.exports = {
    cors,
    bodyParser,
    logMiddleware,
    notFound,
    validation,
    before: [cors(), logMiddleware, bodyParser.json({ limit: '200kb' })],
    after: [notFound, resultHandler, errorHandler]
};
