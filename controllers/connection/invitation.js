/**
 * Connection Invitation Controller
 */
'use strict';

module.exports = exports = {};

const uuidv4 = require('uuid/v4');

const log = require('../../log');
const lib = require('../../lib');
const domainWallet = require('../../domain-wallet');

const MessageService = require('../../services').MessageService;

const Mongoose = require('../../db');
const Message = Mongoose.model('Message');
const Event = Mongoose.model('Event');

const INVITATION_MESSAGE_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/invitation';

exports.INVITATION_MESSAGE_TYPE = INVITATION_MESSAGE_TYPE;

exports.list = async wallet => {
    return await Message.find({
        wallet: wallet.id,
        type: INVITATION_MESSAGE_TYPE
    }).exec();
};

exports.retrieve = async (wallet, id) => {
    return await Message.findOne({
        _id: id,
        wallet: wallet.id,
        type: INVITATION_MESSAGE_TYPE
    }).exec();
};

exports.remove = async (wallet, id) => {
    const invitation = await exports.retrieve(wallet, id);
    if (invitation) {
        await invitation.remove();
        return true;
    }
    return;
};

/**
 * Create a connection invitation
 * @param {Wallet} wallet
 * @param {object} [data] additional data to put in the offer
 * @param {object} [meta] additional meta information to store with offer (and later in pairwise)
 * @param {string} [role] role that is offered, e.g. TRUST_ANCHOR, ..
 * @param {string} [label] suggested label for this connection
 * @return {Promise<Message>} Message object including the connection offer
 */
exports.create = async (wallet, data, meta = {}, role, label = uuidv4()) => {
    // FIXME agent SHOULD create a new routingKey for each connection
    const routingKey = await lib.did.localKeyOf(wallet, await wallet.getEndpointDid());
    const invitation = {
        '@id': uuidv4(),
        '@type': INVITATION_MESSAGE_TYPE,
        label,
        recipientKeys: [await lib.crypto.createKey(wallet)],
        serviceEndpoint: domainWallet.getServiceEndpoint(),
        routingKeys: [routingKey, await domainWallet.getServiceEndpointKey()]
    };
    if (data) {
        invitation['~attach'] = data;
    }
    [meta.myDid, meta.myKey] = await lib.did.create(wallet.handle);
    if (role && typeof role === 'string') {
        meta.role = role;
    }
    const message = await new Message({
        wallet: wallet.id,
        messageId: invitation['@id'],
        messageRef: invitation.recipientKeys[0],
        type: INVITATION_MESSAGE_TYPE,
        senderDid: wallet.ownDid,
        recipientDid: '',
        message: invitation,
        meta
    }).save();

    await Event.createNew('connectionoffer.created', message.id, wallet.id);

    return message;
};

/**
 * Handle reception of connection offer through agent to agent communication
 * @param {Wallet} wallet
 * @param {object} message connection offer
 * @param {*} senderVk
 * @param {*} recipientVk
 */
exports.handle = async (wallet, message, senderVk, recipientVk) => {
    log.debug('received connection invitation', wallet.id, message);

    return await new Message({
        wallet: wallet.id,
        messageId: message['@id'],
        type: INVITATION_MESSAGE_TYPE,
        senderDid: '',
        recipientDid: wallet.ownDid,
        message
    }).save();
};

MessageService.registerHandler(INVITATION_MESSAGE_TYPE, exports.handle);
