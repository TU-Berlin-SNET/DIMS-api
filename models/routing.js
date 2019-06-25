/**
 * Routing Entry Model
 */

const Mongoose = require('../db');

const schema = new Mongoose.Schema(
    {
        // did or key
        _id: {
            type: String
        },
        wallet: {
            type: String,
            required: true,
            ref: 'Wallet'
        }
    },
    { timestamps: true }
);

module.exports = Mongoose.model('Routing', schema);
