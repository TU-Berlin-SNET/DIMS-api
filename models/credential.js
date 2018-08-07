/**
 * IDCHain Agent REST API
 * Schema Model
 */

const Mongoose = require('../db');
const Mixed = Mongoose.Schema.Types.Mixed;

const schema = new Mongoose.Schema({
    created: {
        type: Date,
        default: Date.now
    },
    credDefId: String,
    credId: String,
    credOffer: Mixed,
    masterSecretName: String,
    wallet: {
        type: String
    },
    data: Mixed
});

module.exports = Mongoose.model('Credential', schema);
