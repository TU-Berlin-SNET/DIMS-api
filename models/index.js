/**
 * IDChain Agent REST API
 * Models
 */

const User = require('./user');
const Wallet = require('./wallet');
const Message = require('./message');
const IndySchema = require('./indy-schema');
const CredentialDefinition = require('./credentialdef');
const Credential = require('./credential');
const Proof = require('./proof');
const ProofRequestTemplate = require('./proof-request-template');

module.exports = {
    User,
    Wallet,
    Message,
    IndySchema,
    CredentialDefinition,
    Credential,
    Proof,
    ProofRequestTemplate
};
