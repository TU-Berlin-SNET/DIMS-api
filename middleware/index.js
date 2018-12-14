const cors = require('cors');
const bodyParser = require('body-parser');

const logMiddleware = require('../log').middleware;
const validation = require('./validate');
const notFound = require('./404');
const { resultHandler, errorHandler } = require('./result');

module.exports = {
    before: [cors(), logMiddleware, bodyParser.json(), validation],

    after: [notFound, resultHandler, errorHandler]
};
