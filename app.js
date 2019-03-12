/**
 * IdentityChain Agent REST API
 * Main
 */

const config = require('./config');

const express = require('express');
const YAML = require('yamljs');
const swaggerUi = require('swagger-ui-express');

// require db at start to establish connection
// and all models so they are available
// through Mongoose.model later on
require('./db');
require('./models');

const lib = require('./lib');
const log = require('./log').log;
const middleware = require('./middleware');
const routes = require('./routes');
const message = require('./controllers/message');
const credentialDefinition = require('./controllers/credentialdef');
const APIResult = require('./api-result');
const swaggerDoc = YAML.load('./swagger.yaml');

lib.setup(config.LIB_OPTIONS);

const app = express();

app.use(middleware.before);

app.get('/tails/:tailsHash', credentialDefinition.retrieveTails);

app.post('/indy', message.receiveMessage);

app.get('/healthcheck', (req, res, next) => {
    res.locals.result = APIResult.success({ healthy: true });
    next();
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

app.use('/api/', routes);

app.use(middleware.after);

/**
 * Initializes pool and db connection
 */
async function initialize() {
    try {
        await lib.ledger.createConfig();
    } catch (err) {
        log.warn(err);
    }
    await lib.ledger.open();
    await lib.blobStorage.open();
}

initialize()
    .then(() => {
        const server = app.listen(config.APP_PORT, config.APP_HOST, async () => {
            log.info('IDChain API now up at %s:%s', server.address().address, server.address().port);
            log.info('Access APIDocs at /api/docs');
        });
    })
    .catch(err => {
        log.error(err);
        process.exit(1);
    });

module.exports = app;
