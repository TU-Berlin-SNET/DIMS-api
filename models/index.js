/**
 * IDChain Agent REST API
 * Models
 */

const User = require('./user');
const Wallet = require('./wallet');
const Connection = require('./connection');
const Message = require('./message');
const IndySchema = require('./indy-schema');
const Schema = require('./schema');
const CredentialDefinition = require('./credentialdef');
const Proof = require('./proof');
const ProofRequestTemplate = require('./proof-request-template');
const RevocationRegistry = require('./revocation-registry');
const Routing = require('./routing');

module.exports = {
    User,
    Wallet,
    Connection,
    Message,
    IndySchema,
    Schema,
    CredentialDefinition,
    Proof,
    ProofRequestTemplate,
    RevocationRegistry,
    Routing
};
