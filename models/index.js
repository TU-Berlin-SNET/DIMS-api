/**
 * IDChain Agent REST API
 * Models
 */

const User = require('./user');
const Wallet = require('./wallet');
const Message = require('./message');
const Schema = require('./credentialschema');
const CredentialDefinition = require('./credentialdef');
const Credential = require('./credential');
const Proof = require('./proof');
const ProofRequestTemplate = require('./proof-request-template');

module.exports = {
    User,
    Wallet,
    Message,
    Schema,
    CredentialDefinition,
    Credential,
    Proof,
    ProofRequestTemplate
};
