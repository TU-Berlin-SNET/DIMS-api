/**
 * Connection Invitation Controller
 */
'use strict';

module.exports = exports = {};

const uuidv4 = require('uuid/v4');

const log = require('../../log').log;
const lib = require('../../lib');
const domainWallet = require('../../domain-wallet');

const ConnectionService = require('../../services').ConnectionService;
const MessageService = require('../../services').MessageService;

const INVITATION_MESSAGE_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/invitation';

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
    if (role && typeof role === 'string') {
        meta.role = role;
    }
    const conn = await ConnectionService.create(wallet, {
        label: invitation.label,
        initiator: lib.connection.INITIATOR.ME,
        state: lib.connection.STATE.INVITED,
        stateDirection: lib.connection.STATE_DIRECTION.OUT,
        myKey: invitation.recipientKeys[0],
        invitation,
        meta
    });

    return await ConnectionService.save(wallet, conn);
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
    // TODO validate message is invitation
    const conn = ConnectionService.create(wallet, {
        label: message.label,
        initiator: lib.connection.INITIATOR.OTHER,
        state: lib.connection.STATE.INVITED,
        stateDirection: lib.connection.STATE_DIRECTION.IN,
        theirKey: message.recipientKeys[0],
        invitation: message,
        endpoint: {
            recipientKeys: message.recipientKeys,
            routingKeys: message.routingKeys,
            serviceEndpoint: message.serviceEndpoint
        }
    });
    return ConnectionService.save(wallet, conn);
};

MessageService.registerHandler(INVITATION_MESSAGE_TYPE, exports.handle);
