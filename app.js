/**
 * IdentityChain Agent REST API
 * Main
 */

require('dotenv').config();
const express = require('express');
const indy = require('indy-sdk');
const YAML = require('yamljs');
const swaggerUi = require('swagger-ui-express');
const swaggerDoc = YAML.load('./swagger.yaml');

const log = require('./log').log;
const routes = require('./routes');

const app = express();

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

app.use('/api/', routes);

const server = app.listen(process.env.APP_PORT, process.env.APP_HOST, () => {
  log.info('IDChain API now up at %s:%s',
    server.address().address, server.address().port);
  log.info('Access APIDocs at /api/docs');

  indy.createPoolLedgerConfig(process.env.POOL_NAME, {
    'genesis_txn': __dirname + process.env.GENESIS_TXN,
  }, (err) => {
    if (err) log.warn(err);
  });
});

// for testing purposes
module.exports = app;
