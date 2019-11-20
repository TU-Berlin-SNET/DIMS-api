/**
 * DID Auth Request Controller
 */
'use strict';

const lib = require('../../lib');
const Mongoose = require('../../db');

const Message = Mongoose.model('Message');

const REQUEST_TYPE = lib.message.messageTypes.DIDAUTHREQUEST;

module.exports = exports = {};

exports.list = async wallet => {
    return Message.find({
        wallet: wallet.id,
        type: REQUEST_TYPE
    }).exec();
};

exports.retrieve = async (wallet, id) => {
    return Message.findTypeById(wallet, id, REQUEST_TYPE).exec();
};

exports.remove = async (wallet, id) => {
    const data = await exports.retrieve(wallet, id);
    if (data) {
        await data.remove();
    }
    return data;
};

exports.create = async (wallet, myDid, meta = {}) => {
    const did = myDid || (await wallet.getEndpointDid());
    const request = await lib.didauth.buildRequest(wallet, did);
    const message = await Message.store(wallet.id, request.id, request.type, did, null, request, meta);
    return message;
};
