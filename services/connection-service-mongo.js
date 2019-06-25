/**
 * Connection Service
 * Stores in MongoDB
 */

const log = require('../log').log;
const Connection = require('../models/connection');

module.exports = exports = {};

exports.create = (wallet, options) => {
    return new Connection(Object.assign({}, { wallet: wallet.id }, options));
};

exports.save = async (wallet, connection) => {
    if (!connection.wallet || connection.wallet !== wallet.id) {
        connection.wallet = wallet.id;
    }
    return await connection.save();
};

exports.remove = async (wallet, connection) => {
    if (typeof connection === 'string') {
        connection = await exports.findById(wallet, connection);
    }
    if (!connection) {
        return false;
    }
    await connection.remove();
    return true;
};

exports.find = async (wallet, query = {}) => {
    try {
        return await Connection.find(Object.assign({}, { wallet: wallet.id }, query)).exec();
    } catch (err) {
        log.warn(err);
        return [];
    }
};

exports.findOne = async (wallet, query) => {
    try {
        return await Connection.findOne(Object.assign({}, { wallet: wallet.id }, query)).exec();
    } catch (err) {
        log.warn(err);
        return;
    }
};

exports.findById = async (wallet, id) => {
    return exports.findOne(wallet, { _id: id });
};
