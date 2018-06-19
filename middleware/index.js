
const logMiddleware = require('../log').middleware;
const bodyParser = require('body-parser');
const validation = require('./validate');
const notFound = require('./404');
const {resultMiddleware, errorMiddleware} = require('./result');

module.exports = {
  before: [
    logMiddleware,
    bodyParser.json(),
    validation,
  ],

  after: [
    notFound,
    resultMiddleware,
    errorMiddleware,
  ],
};
