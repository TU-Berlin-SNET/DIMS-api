/**
 * IdentityChain Agent REST API
 * Main
 */

const config = require('./config');

const http = require('http');
const express = require('express');

// require db at start to establish connection
// and all models so they are available
// through Mongoose.model later on
require('./db');
require('./models');

const websocket = require('./websocket');
const lib = require('./lib');
const log = require('./log');
const domainWallet = require('./domain-wallet');
const routes = require('./routes/index');

lib.setup(config.LIB_OPTIONS);

const app = express();
const server = http.createServer(app);

// initialize websocket server
websocket(server);

app.use('/', routes);

/**
 * Initializes pool and db connection
 */
async function initialize() {
    try {
        await lib.ledger.createConfig();
    } catch (err) {
        log.warn(err);
    }
    await domainWallet.init();
    await lib.ledger.open();
    await lib.blobStorage.open();
}

initialize()
    .then(() => {
        server.listen(config.APP_PORT, config.APP_HOST, () => {
            log.info('API now up at %s:%s', server.address().address, server.address().port);
            log.info('Access APIDocs at /api/v1/docs or /api/v2/docs');
        });
    })
    .catch(err => {
        log.error(err);
        process.exit(1);
    });

module.exports = app;
