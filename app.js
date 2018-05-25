/**
 * IdentityChain Agent REST API
 * Main
 */

require('dotenv').config();
const express = require('express');
const YAML = require('yamljs');
const swaggerUi = require('swagger-ui-express');
const swaggerDoc = YAML.load('./swagger.yaml');

const log = require('./log').log;
const pool = require('./pool');
const middleware = require('./middleware');
const routes = require('./routes');

const app = express();

app.use(middleware.before);

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

app.use('/api/', routes);

app.use(middleware.after);

const server = app.listen(process.env.APP_PORT, process.env.APP_HOST, async () => {
  log.info('IDChain API now up at %s:%s',
    server.address().address, server.address().port);
  log.info('Access APIDocs at /api/docs');

  try {
    await pool.createConfig();
    await pool.openLedger();
  } catch (err) {
    log.err(err);
    process.exit(1);
  }
});

// for testing purposes
module.exports = app;
