const sdk = require('indy-sdk');
const connection = require('./connection');
const credential = require('./credential');
const credentialdefinition = require('./credentialdefinition');
const crypto = require('./crypto');
const did = require('./did');
const message = require('./indy-message');
const ledger = require('./ledger');
const pairwise = require('./pairwise');
const proof = require('./proof');
const record = require('./record');
const schema = require('./schema');
const tails = require('./tails');

module.exports = {
    sdk,
    connection,
    credential,
    credentialdefinition,
    crypto,
    did,
    message,
    ledger,
    pairwise,
    proof,
    record,
    schema,
    tails
};
