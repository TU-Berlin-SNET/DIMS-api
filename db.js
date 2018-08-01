/**
 * Mongoose Initialization and initial connection establishment
 */

const Mongoose = require('mongoose');
const log = require('./log').log;

const connRetriesLimit = 3;
const connRetriesInterval = 1000;

let connString = 'mongodb://';
let connRetries = 0;

Mongoose.Promise = global.Promise;

if (process.env.DB_USER) {
  connString += `${process.env.DB_USER}:${process.env.DB_PASSWORD}@`;
}
connString += `${process.env.DB_HOST}:${process.env.DB_PORT}/idchain`;

setTimeout(connect, 2000);

/**
 * Connect to MongoDB
 */
function connect() {
  Mongoose.connect(connString, function(error) {
    if (error) {
      log.error(error);
      if (connRetries < connRetriesLimit) {
        connRetries++;
        log.info(
          `Retrying to connect to MongoDB in ${connRetriesInterval}ms` +
          `- [${connRetries}/${connRetriesLimit}]`,
        );
        setTimeout(connect, connRetriesInterval);
      } else {
        process.exit(1);
      }
    }
  });
}

module.exports = Mongoose;
