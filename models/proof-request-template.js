/**
 * IDChain Agent REST API
 * Proof Request Template Model
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
        template: {
            type: String,
            required: true
        }
    },
    { timestamps: true, minimize: false }
);

schema.set('toJSON', {
    versionKey: false,
    transform: (doc, ret, options) => {
        ret.id = String(ret._id);
        delete ret._id;
    }
});

module.exports = Mongoose.model('ProofRequestTemplate', schema);
