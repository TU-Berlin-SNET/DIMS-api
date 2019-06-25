/**
 * Connection
 * Base Controller
 */
'use strict';

const Invitation = require('./invitation');
const Request = require('./request');
const Response = require('./response');
const ConnectionService = require('../../services').ConnectionService;

module.exports = exports = {};

exports.list = ConnectionService.find;
exports.create = ConnectionService.create;
exports.retrieve = ConnectionService.findById;
exports.remove = ConnectionService.remove;
exports.createInvitation = Invitation.create;
exports.receiveInvitation = Invitation.handle;
exports.createRequest = Request.create;
exports.receiveRequest = Request.handle;
exports.createResponse = Response.create;
exports.receiveResponse = Response.handle;
