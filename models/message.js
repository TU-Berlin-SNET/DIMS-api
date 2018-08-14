const Mongoose = require('../db');

const schema = new Mongoose.Schema({
    wallet: {
        type: String,
        ref: 'Wallet',
        required: true,
        index: true
    },
    messageId: {
        type: String,
        required: true,
        index: true
    },
    type: {
        type: String,
        required: true
    },
    message: {
        type: Mongoose.Schema.Types.Mixed,
        required: true
    }
});

module.exports = Mongoose.model('Message', schema);
