/**
 * IDChain Agent REST API
 * Test Variables
 */

require('dotenv').config();
const supertest = require('supertest');

module.exports.serverURL = `http://${process.env.APP_HOST}:${process.env.APP_PORT}`;
module.exports.agent = supertest(module.exports.serverURL);

module.exports.acceptHeader = {'Accept': 'application/json'};
module.exports.contentHeader = {'Content-Type': 'application/json'};
module.exports.bothHeaders = Object.assign(
  {}, module.exports.acceptHeader, module.exports.contentHeader);

module.exports.users = [
  {username: 'teststeward'+Math.random(), password: 'steward'},
  {username: 'testissuer'+Math.random(), password: 'issuer'},
  {username: 'testholder'+Math.random(), password: 'holder'},
  {username: 'testrelyingpary'+Math.random(), password: 'relyingpary'},
];

module.exports.wallets = [
    {name: 'teststewardWallet'+Math.random(), seed: '000000000000000000000000Steward1', credentials: {key:'teststewardkey'}},
    {name: 'testissuerWallet'+Math.random(), credentials: {key:'testissuerKey'}},
    {name: 'testholderWallet'+Math.random(), credentials: {key:'testholderKey'}},
    {name: 'testrelyingparywallet'+Math.random(), credentials: {key:'testrelyingparyKey'}},
];

module.exports.validSchema = {
  wallet: module.exports.wallets[1].name,
  name: 'Passport',
  version: '1.0',
  attrNames: ['firstname', 'lastname', 'yearOfBirth'],
};

module.exports.invalidSchema = {/* TODO */};
