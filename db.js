/**
 * Mongoose Initialization and initial connection establishment
 */

const Mongoose = require('mongoose');
Mongoose.Promise = global.Promise;

let connString = 'mongodb://';
if (process.env.DB_USER) {
  connString += `${process.env.DB_USER}:${process.env.DB_PASSWORD}@`;
}
connString += `${process.env.DB_HOST}:${process.env.DB_PORT}/idchain`;
Mongoose.connect(connString, function(error) {
  if (error) {
    throw error;
  }
});

module.exports = Mongoose;
