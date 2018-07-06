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
  {username: 'teststeward', password: 'steward'},
  {username: 'testissuer', password: 'issuer'},
  {username: 'testholder', password: 'holder'},
  {username: 'testrelyingpary', password: 'relyingpary'},
];

module.exports.wallets = [
    {name: 'teststewardWallet', seed: '000000000000000000000000Steward1'},
    {name: 'testissuerWallet'},
    {name: 'testholderWallet'},
    {name: 'testrelyingparywallet'},
];

module.exports.validSchema = {
  wallet: module.exports.wallets[1].name,
  name: 'Passport',
  version: '1.0',
  attrNames: ['firstname', 'lastname', 'yearOfBirth'],
};

module.exports.invalidSchema = {/* TODO */};
