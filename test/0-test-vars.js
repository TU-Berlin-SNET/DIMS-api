/**
 * IDChain Agent REST API
 * Test Variables
 */

const config = require('../config');
const supertest = require('supertest');

module.exports.serverURL = `http://${process.env.IDC_API_HOST}:${process.env.IDC_API_PORT}`;
module.exports.agent = supertest(module.exports.serverURL);

module.exports.acceptHeader = { Accept: 'application/json' };
module.exports.contentHeader = { 'Content-Type': 'application/json' };
module.exports.bothHeaders = Object.assign({}, module.exports.acceptHeader, module.exports.contentHeader);
module.exports.stewardSeed = '000000000000000000000000Steward1';
module.exports.AGENT_ENDPOINT = config.APP_AGENT_ENDPOINT;
