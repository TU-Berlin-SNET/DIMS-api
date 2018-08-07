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

const randomNumber = Math.round(Math.random() * 100);

module.exports.users = [
    { username: 'teststeward' + randomNumber, password: 'steward' },
    { username: 'testissuer' + randomNumber, password: 'issuer' },
    { username: 'testholder' + randomNumber, password: 'holder' },
    { username: 'testrelyingpary' + randomNumber, password: 'relyingpary' }
];

module.exports.wallets = [
    {
        name: 'teststewardWallet' + randomNumber,
        seed: '000000000000000000000000Steward1',
        credentials: { key: 'teststewardkey' }
    },
    { name: 'testissuerWallet' + randomNumber, credentials: { key: 'testissuerKey' } },
    { name: 'testholderWallet' + randomNumber, credentials: { key: 'testholderKey' } },
    { name: 'testrelyingparywallet' + randomNumber, credentials: { key: 'testrelyingparyKey' } }
];

module.exports.validSchema = {
    wallet: module.exports.wallets[1].name,
    name: 'Passport',
    version: '1.0',
    attrNames: ['firstname', 'lastname', 'yearOfBirth']
};

module.exports.invalidSchema = {
    /* TODO */
};
