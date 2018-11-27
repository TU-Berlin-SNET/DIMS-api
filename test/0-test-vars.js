/**
 * IDChain Agent REST API
 * Test Variables
 */

require('dotenv').config();
const supertest = require('supertest');

module.exports.serverURL = `http://${process.env.APP_HOST}:${process.env.APP_PORT}`;
module.exports.agent = supertest(module.exports.serverURL);

module.exports.acceptHeader = { Accept: 'application/json' };
module.exports.contentHeader = { 'Content-Type': 'application/json' };
module.exports.bothHeaders = Object.assign({}, module.exports.acceptHeader, module.exports.contentHeader);
module.exports.stewardSeed = '000000000000000000000000steward1';
module.exports.AGENT_ENDPOINT =
    process.env.APP_DOMAIN_PROTOCOL +
    '://' +
    process.env.APP_DOMAIN_HOST +
    (process.env.APP_DOMAIN_PORT ? `:${process.env.APP_DOMAIN_PORT}` : '') +
    '/indy';
