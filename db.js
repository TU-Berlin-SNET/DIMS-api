/**
 * Mongoose Initialization and initial connection establishment
 */

const Mongoose = require('mongoose');
const log = require('./log').log;

const connRetriesLimit = 3;
const connRetriesInterval = 3000;

let connString = 'mongodb://';
let connRetries = 0;

Mongoose.Promise = global.Promise;

if (process.env.IDC_API_DB_USER) {
    connString += `${process.env.IDC_API_DB_USER}:${process.env.IDC_API_DB_PASSWORD}@`;
}
connString += `${process.env.IDC_API_DB_HOST}:${process.env.IDC_API_DB_PORT}/idchain`;

/**
 * Connect to MongoDB
 */
function connect() {
    Mongoose.connect(connString)
        .then(() => log.info('connection to database established'))
        .catch(error => {
            log.error(error);
            if (connRetries < connRetriesLimit) {
                connRetries++;
                log.info(
                    `Retrying to connect to MongoDB in ${connRetriesInterval}ms` +
                        `- [${connRetries}/${connRetriesLimit}]`
                );
                setTimeout(connect, connRetriesInterval);
            } else {
                process.exit(1);
            }
        });
}
connect();

module.exports = Mongoose;
