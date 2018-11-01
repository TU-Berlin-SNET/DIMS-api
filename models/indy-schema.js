/**
 * IDCHain Agent REST API
 * Indy Low Level Schema Model
 */

const Mongoose = require('../db');
const Mixed = Mongoose.Schema.Types.Mixed;

const schema = new Mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        },
        attrNames: {
            type: Array,
            required: true,
            default: null
        },
        version: {
            type: String,
            required: true,
            default: null
        },
        wallet: {
            type: String
        },
        schemaId: String,
        data: Mixed
    },
    { timestamps: true }
);

module.exports = Mongoose.model('IndySchema', schema);
