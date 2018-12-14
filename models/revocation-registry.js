/**
 * IDChain Agent REST API
 * Revocation registry model
 */

const Mongoose = require('../db');

const schema = new Mongoose.Schema({
    created: {
        type: Date,
        default: Date.now
    },
    revocRegDefId: {
        type: String,
        index: true
    },
    credDefId: {
        type: String,
        index: true
    },
    hash: {
        type: String
    }
});

module.exports = Mongoose.model('RevocationRegistry', schema);
