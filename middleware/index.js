const cors = require('cors');
const bodyParser = require('body-parser');

const logMiddleware = require('../log').middleware;
const validation = require('./validate');
const notFound = require('./404');
const { resultHandler, errorHandler } = require('./result');

module.exports = {
    before: [cors(), logMiddleware, bodyParser.json({ limit: '200kb' }), validation],

    after: [notFound, resultHandler, errorHandler]
};
