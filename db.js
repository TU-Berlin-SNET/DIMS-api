/**
 * Mongoose Initialization and initial connection establishment
 */

const Mongoose = require('mongoose');
const log = require('./log').log;
Mongoose.Promise = global.Promise;

let connString = 'mongodb://';
if (process.env.DB_USER) {
  connString += `${process.env.DB_USER}:${process.env.DB_PASSWORD}@`;
}
connString += `${process.env.DB_HOST}:${process.env.DB_PORT}/idchain`;
Mongoose.connect(connString, function(error) {
  if (error) {
    log.error(error);
    process.exit(1);
  }
});

module.exports = Mongoose;
