/**
 * IDChain Agent REST API
 * Models
 */

const User = require('./user');
const Wallet = require('./wallet');
const Message = require('./message');
const ConnectionOffer = require('./connectionoffer');
const Schema = require('./credentialschema');
const CredentialOffer = require('./credentialoffer');
const CredentialRequest = require('./credentialreq');
const CredentialDefinition = require('./credentialdef');
const Credential = require('./credential');
const ProofRequest = require('./proofreq');

module.exports = {
    User,
    Wallet,
    Message,
    ConnectionOffer,
    Schema,
    CredentialOffer,
    CredentialRequest,
    CredentialDefinition,
    Credential,
    ProofRequest
};
