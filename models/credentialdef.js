/**
 * IDChain Agent REST API
 * Credential Definition Model
 */

const Mongoose = require('../db');
const Mixed = Mongoose.Schema.Types.Mixed;

const schema = new Mongoose.Schema({
    created: {
        type: Date,
        default: Date.now
    },
    credDefId: {
        type: String,
        index: true
    },
    revocRegDefId: {
        type: String
    },
    revocRegType: {
        type: String
    },
    wallet: {
        type: String,
        ref: 'Wallet'
    },
    data: Mixed
});

module.exports = Mongoose.model('CredentialDefinition', schema);
