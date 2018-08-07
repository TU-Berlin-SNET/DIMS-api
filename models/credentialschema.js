/**
 * IDCHain Agent REST API
 * Schema Model
 */

const Mongoose = require('../db');
const indy = require('indy-sdk');
const wrap = require('../asyncwrap').wrap;
const pool = require('../pool');
var Mixed = Mongoose.Schema.Types.Mixed;

const schema = new Mongoose.Schema({
    // TODO Check if extra id is needed on top of name
    // should name be primary key
    created: {
        type: Date,
        default: Date.now
    },
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
});

schema.pre('save', async () => {});

schema.methods['getSchemaFromLedger'] = wrap(async (submitterDid, schemaId) => {
    let request = await indy.buildGetSchemaRequest(submitterDid, schemaId);
    let response = await indy.submitRequest(pool.handle, request);
    return await indy.parseGetSchemaResponse(response);
});

module.exports = Mongoose.model('Schema', schema);
