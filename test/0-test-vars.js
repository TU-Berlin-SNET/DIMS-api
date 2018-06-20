/**
 * IDChain Agent REST API
 * Test Variables
 */

module.exports.acceptHeader = {'Accept': 'application/json'};
module.exports.contentHeader = {'Content-Type': 'application/json'};
module.exports.bothHeaders = Object.assign({},
  module.exports.acceptHeader, module.exports.contentHeader);

module.exports.users = [
  {username: 'steward', password: 'steward'},
  {username: 'issuer', password: 'issuer'},
  {username: 'holder', password: 'holder'},
  {username: 'relyingpary', password: 'relyingpary'},
];

module.exports.wallets = [
    {name: 'stewardWallet', seed: '000000000000000000000000Steward1'},
    {name: 'issuerWallet'},
    {name: 'holderWallet'},
    {name: 'relyingparywallet'},
];
