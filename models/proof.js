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
        meta: {}
    },
    { timestamps: true, minimize: false }
);

schema
    .virtual('isValid')
    .get(function() {
        return this.__isValid || false;
    })
    .set(function(value) {
        this.__isValid = value;
    });

schema.set('toJSON', {
    versionKey: false,
    virtuals: true,
    transform: (doc, ret, options) => {
        ret.id = String(ret._id);
        delete ret.meta;
        delete ret._id;
    }
});

module.exports = Mongoose.model('Proof', schema);
