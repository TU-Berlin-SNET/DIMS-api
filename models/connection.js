/**
 * Connection Model
 */

const uuidv4 = require('uuid/v4');
const lib = require('../lib');
const log = require('../log').log;
const Mongoose = require('../db');

const schema = new Mongoose.Schema(
    {
        wallet: {
            type: String,
            ref: 'Wallet',
            required: true,
            index: true
        },
        label: {
            type: String,
            default: uuidv4()
        },
        initiator: {
            type: String,
            required: true,
            default: lib.connection.INITIATOR.ME
        },
        state: {
            type: String,
            required: true,
            default: lib.connection.STATE.NULL
        },
        stateDirection: {
            type: String
        },
        threadId: {
            type: String
        },
        invitation: {},
        request: {},
        response: {},
        error: {},
        myDid: {
            type: String
        },
        myKey: {
            type: String
        },
        myDidDoc: {},
        theirDid: {
            type: String
        },
        theirKey: {
            type: String
        },
        theirDidDoc: {},
        /**
         * Contains their recipientKeys, routingKeys,
         * and serviceEndpoint address parsed from did-doc
         */
        endpoint: {},
        meta: {}
    },
    { timestamps: true, minimize: false }
);

schema.set('toJSON', {
    depopulate: true,
    versionKey: false,
    transform: (doc, ret, options) => {
        ret.id = String(ret._id);
        delete ret._id;
    }
});

module.exports = Mongoose.model('Connection', schema);
