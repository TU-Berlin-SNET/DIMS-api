/**
 * Connection
 * Base Controller
 */
'use strict';

const lib = require('../../lib');
const Invitation = require('./invitation');
const Request = require('./request');
const Response = require('./response');
const ConnectionService = require('../../services').ConnectionService;

module.exports = exports = {};

exports.createInvitation = Invitation.create;
exports.receiveInvitation = Invitation.handle;
exports.createRequest = Request.create;
exports.receiveRequest = Request.handle;
exports.createResponse = Response.create;
exports.receiveResponse = Response.handle;

exports.list = async (wallet, query) => {
    return (await ConnectionService.find(wallet, query)).map(v => {
        return {
            my_did: v.myDid,
            their_did: v.theirDid,
            acknowledged: v.state === lib.connection.STATE.COMPLETE
        };
    });
};

exports.retrieve = async (wallet, myDid) => {
    const connection = await ConnectionService.findOne(wallet, { myDid });
    if (connection) {
        return {
            my_did: connection.myDid,
            their_did: connection.theirDid,
            acknowledged: connection.state === lib.connection.STATE.COMPLETE
        };
    } else {
        return;
    }
};

exports.remove = async (wallet, myDid) => {
    const connection = await exports.retrieve(wallet, myDid);
    return await ConnectionService.remove(wallet, connection);
};
