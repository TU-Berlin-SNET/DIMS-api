const sdk = require('indy-sdk');
const connection = require('./connection');
const credential = require('./credential');
const crypto = require('./crypto');
const did = require('./did');
const message = require('./indy-message');
const ledger = require('./ledger');
const pairwise = require('./pairwise');
const proof = require('./proof');
const record = require('./record');
const tails = require('./tails');

module.exports = {
    sdk,
    connection,
    credential,
    crypto,
    did,
    message,
    ledger,
    pairwise,
    proof,
    record,
    tails
};
