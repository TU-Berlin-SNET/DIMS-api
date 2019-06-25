/**
 * Indy SDK Wrapper
 */
const log = require('./log');

exports = module.exports = {};

exports.sdk = require('indy-sdk');
exports.blobStorage = require('./blob-storage');
exports.connection = require('./connection');
exports.credential = require('./credential');
exports.credentialdefinition = require('./credentialdefinition');
exports.crypto = require('./crypto');
exports.did = require('./did');
exports.diddoc = require('./diddoc');
exports.message = require('./indy-message');
exports.ledger = require('./ledger');
exports.pairwise = require('./pairwise');
exports.proof = require('./proof');
exports.walletRecord = require('./wallet-record');
exports.Wallet = require('./wallet');
exports.revocation = require('./revocation');
exports.schema = require('./schema');

/**
 * Setup and initialize lib, must be called before any other parts of lib are used
 * @param {object} [options] {
 *     logger: <logger with trace, debug, info, warn, and error methods for logging>,
 *     runtimeConfig: <indy-sdk runtimeConfig object>,
 *     pool: {
 *         name: <string>,
 *         config: { genesis_txn: <string> },
 *         info: { ip: <string>, port: <number> }
 *     },
 *     blobStorage: {
 *         type: <string>,
 *         config: {
 *             base_dir: <string>,
 *             uri_pattern: <string>
 *         }
 *     }
 * }
 */
exports.setup = function(options = {}) {
    if (options.runtimeConfig) {
        exports.sdk.setRuntimeConfig(options.runtimeConfig);
    }

    if (options.logger) {
        log.logger = options.logger;
        exports.sdk.setDefaultLogger('debug');
        // exports.sdk.setLogger(log.sdkLog());
    } else {
        exports.sdk.setDefaultLogger('debug');
    }

    exports.ledger.setup(options.pool.name, options.pool.config, options.pool.runtimeConfig, options.pool.info);
    exports.blobStorage.setup(options.blobStorage.config, options.blobStorage.type);
};
