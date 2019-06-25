/**
 * IDChain Agent REST API
 * Connection Request Controller
 */
'use strict';

module.exports = exports = {};

const uuidv4 = require('uuid/v4');

const lib = require('../../lib');
const log = require('../../log').log;
const APIResult = require('../../util/api-result');
const domainWallet = require('../../domain-wallet');
const Invitation = require('./invitation');
const Response = require('./response');

const ConnectionService = require('../../services').ConnectionService;
const MessageService = require('../../services').MessageService;

const REQUEST_MESSAGE_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/request';

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
    let conn;
    if (invitation) {
        conn = await Invitation.handle(wallet, invitation);
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
    conn.myDid = myDid;
    conn.myKey = myVk;
    conn.myDidDoc = myDidDoc;
    conn.request = request;
    conn.threadId = request['@id'];
    conn.state = lib.connection.STATE.REQUESTED;
    conn.stateDirection = lib.connection.STATE_DIRECTION.OUT;

    const result = await ConnectionService.save(wallet, conn);
    await MessageService.send(wallet, conn.request, conn.endpoint);

    return result;
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
    let conn = await ConnectionService.findOne(wallet, {
        myKey: recipientVk,
        state: lib.connection.STATE.INVITED,
        stateDirection: lib.connection.STATE_DIRECTION.OUT
    });
    if (!conn) {
        log.info('invalid connection request, no invitation found');
        throw APIResult.badRequest('invalid connection request, no invitation found');
    }
    conn.state = lib.connection.STATE.REQUESTED;
    conn.stateDirection = lib.connection.STATE_DIRECTION.IN;
    conn.request = message;
    conn.threadId = message['@id'];
    conn.theirLabel = message.label;
    [, conn.theirDid] = lib.diddoc.parseDidWithMethod(message.connection.did);
    conn.theirDidDoc = message.connection.did_doc;
    conn.endpoint = await lib.diddoc.getDidcommService(wallet, message.connection.did_doc);
    conn.theirKey = conn.endpoint.recipientKeys[0];

    if (conn.invitation) {
        await Response.create(wallet, await ConnectionService.save(wallet, conn));
    } else {
        await ConnectionService.save(wallet, conn);
    }
};

MessageService.registerHandler(REQUEST_MESSAGE_TYPE, exports.handle);
