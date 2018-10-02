/**
 * IdentityChain Agent REST API
 * Main
 */

require('dotenv').config();
const express = require('express');
const YAML = require('yamljs');
const swaggerUi = require('swagger-ui-express');

// require db at start to establish connection
// and all models so they are available
// through Mongoose.model later on
require('./db');
require('./models');
const log = require('./log').log;
const pool = require('./pool');
const middleware = require('./middleware');
const routes = require('./routes');
const message = require('./controllers/message');
const APIResult = require('./api-result');
const swaggerDoc = YAML.load('./swagger.yaml');

const app = express();

app.use(middleware.before);

app.post('/indy', message.receiveMessage);

app.get('/healthcheck', (req, res, next) => {
    return next(APIResult.success({ healthy: true }));
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

app.use('/api/', routes);

app.use(middleware.after);

/**
 * Initializes pool and db connection
 */
async function initialize() {
    try {
        await pool.createConfig();
    } catch (err) {
        log.warn(err);
    }

    await pool.openLedger();
}

initialize()
    .then(() => {
        const server = app.listen(process.env.APP_PORT, process.env.APP_HOST, async () => {
            log.info('IDChain API now up at %s:%s', server.address().address, server.address().port);
            log.info('Access APIDocs at /api/docs');
        });
    })
    .catch(err => {
        log.error(err);
        process.exit(1);
    });

module.exports = app;
