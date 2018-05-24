
const logMiddleware = require('../log').middleware;
const bodyParser = require('body-parser');
const notFound = require('./404');
const errorMiddleware = require('./error');

module.exports = {
  before: [
    logMiddleware,
    bodyParser.json(),
  ],

  after: [
    notFound,
    errorMiddleware,
  ],
};
