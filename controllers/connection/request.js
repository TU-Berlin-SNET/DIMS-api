/**
 * IDChain Agent REST API
 * Connection Request Controller
 */
'use strict';

module.exports = exports = {};

const uuidv4 = require('uuid/v4');

const lib = require('../../lib');
const log = require('../../log');
const APIResult = require('../../util/api-result');
const domainWallet = require('../../domain-wallet');
const Invitation = require('./invitation');
const Response = require('./response');

const Mongoose = require('../../db');
const Message = Mongoose.model('Message');
const Event = Mongoose.model('Event');

const MessageService = require('../../services').MessageService;

const REQUEST_MESSAGE_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/request';

exports.list = async wallet => {
    return await Message.find({
        wallet: wallet.id,
        type: REQUEST_MESSAGE_TYPE
    }).exec();
};

exports.retrieve = async (wallet, id) => {
    return await Message.findOne({
        _id: id,
        wallet: wallet.id,
        type: REQUEST_MESSAGE_TYPE
    }).exec();
};

exports.remove = async (wallet, id) => {
    const request = await exports.retrieve(wallet, id);
    if (request) {
        await request.remove();
        return true;
    }
    return;
};

/**
 * Create and send a connection request,
 * one of invitation, diddoc, or public did MUST be present
 * @param {Wallet} wallet
 * @param {string} [label]
 * @param {object} [invitation]
 * @param {string} [did]
 * @return {Promise<object>} connection
 */
exports.create = async (wallet, label = uuidv4(), invitation, did) => {
    let endpoint;
    if (invitation) {
        const inviteMessage = await Invitation.handle(wallet, invitation);
        endpoint = {
            recipientKeys: inviteMessage.message.recipientKeys,
            routingKeys: inviteMessage.message.routingKeys,
            serviceEndpoint: inviteMessage.message.serviceEndpoint
        };
    } else if (did) {
        // implicit invitation through public did currently not supported
        throw APIResult.create(501, 'not implemented');
    } else {
        throw APIResult.badRequest('one of invitation or did must be present');
    }

    const [myDid, myVk] = await lib.did.create(wallet.handle);
    // currently only did:peer: method is supported
    const myDidDoc = await lib.diddoc.buildPeerDidDoc(myDid, wallet, domainWallet);
    const request = {
        '@id': uuidv4(),
        '@type': REQUEST_MESSAGE_TYPE,
        label,
        connection: {
            did: myDidDoc.id,
            did_doc: myDidDoc
        }
    };
    const meta = { invitationKey: endpoint.recipientKeys[0] };

    const message = await new Message({
        wallet: wallet.id,
        messageId: request['@id'],
        threadId: request['@id'],
        type: REQUEST_MESSAGE_TYPE,
        senderDid: myDid,
        message: request,
        meta
    }).save();

    await MessageService.send(wallet, request, endpoint);

    return message;
};

/**
 * Handle reception of connection request through agent to agent communication
 * @param {Wallet} wallet
 * @param {object} message connection request
 * @param {*} senderVk
 * @param {*} recipientVk
 */
exports.handle = async (wallet, message, senderVk, recipientVk) => {
    log.debug('received connection request', wallet.id, message);
    const invitation = await Message.findOne({
        wallet: wallet.id,
        messageRef: recipientVk,
        type: Invitation.INVITATION_MESSAGE_TYPE
    }).exec();
    const [, theirDid] = lib.diddoc.parseDidWithMethod(message.connection.did);
    const request = await new Message({
        wallet: wallet.id,
        messageId: message['@id'],
        threadId: message['@id'],
        type: REQUEST_MESSAGE_TYPE,
        senderDid: theirDid,
        recipientDid: wallet.ownDid,
        message
    }).save();

    Event.createNew('connectionrequest.received', request.id, wallet.id);

    if (invitation) {
        request.meta = {
            invitation: invitation.message,
            invitationMeta: invitation.meta
        };
        await request.save();
        // remove invitation to prevent replays
        await invitation.remove();

        Response.create(wallet, request);
    }
};

MessageService.registerHandler(REQUEST_MESSAGE_TYPE, exports.handle);
