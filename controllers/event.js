/**
 * Events Controller
 */
'use strict';

const Mongoose = require('../db');
const Event = Mongoose.model('Event');

module.exports = exports = {};

/**
 * List events for wallet
 * @param {object} wallet
 * @param {object} [query]
 * @return {Promise<Array>}
 */
exports.list = async (wallet, query = {}) => {
    const mergedQuery = Object.assign({}, query, { wallet: wallet.id });
    return Event.find(mergedQuery).exec();
};

/**
 * Retrieve event by id
 * @param {object} wallet
 * @param {string} id
 * @return {Promise<Object>}
 */
exports.retrieve = async (wallet, id) => {
    return Event.find({
        _id: id,
        wallet: wallet.id
    }).exec();
};

/**
 * Remove event by id
 * @param {object} wallet
 * @param {string} id
 * @return {Promise<Object>}
 */
exports.remove = async (wallet, id) => {
    const event = await exports.retrieve(wallet, id);
    if (event) {
        await event.remove();
    }
    return event;
};
