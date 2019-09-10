/**
 * Event Model
 */
'use strict';

const Mongoose = require('../db');
const eventBus = require('../eventbus');

const schema = new Mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        },
        // TODO maybe add a resource field?
        ref: {
            type: String,
            required: true
        },
        wallet: {
            type: String,
            ref: 'Wallet'
        }
    },
    { timestamps: true }
);

schema.statics.createNew = async function(name, ref, wallet) {
    return new this({ name, ref, wallet }).save();
};

schema.post('save', doc => {
    eventBus.emit('event.created', doc);
});

schema.set('toJSON', {
    depopulate: true,
    versionKey: false,
    transform: (doc, ret, options) => {
        ret.id = String(ret._id);
        delete ret._id;
    }
});

module.exports = Mongoose.model('Event', schema);
