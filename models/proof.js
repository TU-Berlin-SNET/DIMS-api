/**
 * IDChain Agent REST API
 * Proof Model
 */

const Mongoose = require('../db');

const schema = new Mongoose.Schema(
    {
        wallet: {
            type: String,
            ref: 'Wallet',
            required: true,
            index: true
        },
        did: {
            type: String,
            required: true,
            index: true
        },
        proof: {
            type: Mongoose.Schema.Types.Mixed,
            default: null
        },
        status: {
            type: String,
            required: true,
            default: 'pending',
            enum: ['pending', 'received']
        },
        isValid: {
            type: Boolean,
            required: false
        },
        meta: {}
    },
    { timestamps: true, minimize: false }
);

schema.set('toJSON', {
    versionKey: false,
    transform: (doc, ret, options) => {
        ret.id = String(ret._id);
        delete ret.meta;
        delete ret._id;
    }
});

module.exports = Mongoose.model('Proof', schema);
