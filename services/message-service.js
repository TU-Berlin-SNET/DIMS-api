/**
 * IDChain Agent REST API
 * Message Controller
 */

const log = require('../log').log;
const lib = require('../lib');
const Routing = require('../models/routing');
const ConnectionService = require('../services').ConnectionService;

const WalletProvider = require('../middleware/walletProvider');
const domainWallet = require('../domain-wallet');

module.exports = exports = {};

const FORWARD_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/routing/1.0/forward';

const handlers = {};

const transports = {};

exports.registerHandler = function(type, fn) {
    log.info('registering handler for', type);
    if (handlers[type]) {
        log.debug('replacing handler', type, handlers[type]);
    }
    handlers[type] = fn;
};

exports.registerTransport = function(name, transport) {
    log.info('registering protocol', name);
    transports[name] = transport;
    transport.onReceive(exports.receive);
};

exports.getTransport = function(endpoint) {
    log.debug('retrieving transport for', endpoint);
    const name = endpoint.substring(0, endpoint.indexOf(':'));
    return transports[name];
};

exports.getHandler = function(message) {
    // FIXME remove `message.type` when compatibility with old message types is not needed anymore
    const messageType = message['@type'] || message.type;
    log.debug('retrieving handler for', messageType);
    return handlers[messageType];
};

exports.send = async (wallet, message, target) => {
    // TODO swap this for wrapMessage once all clients support
    // pack-/unpackMessage (indy-sdk >= 1.8.x)
    const packed = await wrapMessageAnon(wallet, message, target);
    const transport = exports.getTransport(target.serviceEndpoint);
    await transport.send(target.serviceEndpoint, packed);
};

exports.receive = async message => {
    let wallet;
    let unpacked;
    try {
        // FIXME swap this for unwrapMessage once all clients support pack-/unpackMessage (indy-sdk >= 1.8.x)
        [wallet, unpacked] = await unwrapMessageAnon(message);
        const handler = exports.getHandler(unpacked.message);
        await updateConnectionComplete(wallet, unpacked.sender_verkey, unpacked.recipient_verkey);
        if (!handler) {
            // TODO respond with error?
            throw Error('unknown message type ' + message['@type']);
        }
        return await handler(wallet, unpacked.message, unpacked.sender_verkey, unpacked.recipient_verkey);
    } finally {
        await WalletProvider.returnHandle(wallet);
    }
};

/**
 *
 * @param {string} key
 * @return {object} wallet
 */
async function getWalletFromKey(key) {
    const routing = await Routing.findOne({ _id: key })
        .populate('wallet')
        .exec();
    log.debug('retrieved routing from', key, routing);
    const wallet = routing.wallet;
    log.debug('retrieved wallet from routing', wallet);
    await WalletProvider.provideHandle(wallet);
    return wallet;
}

/**
 * Check if connection exists and if state should be updated to complete,
 * update if conditions apply
 * @param {Wallet} wallet
 * @param {string} theirKey verification key
 * @param {string} myKey verification key
 * @return {Promise<void>}
 */
async function updateConnectionComplete(wallet, theirKey, myKey) {
    if (!myKey || !theirKey) {
        log.debug('missing myKey or theirKey', myKey, theirKey);
        return;
    }
    const connection = await ConnectionService.findOne(wallet, { myKey, theirKey });
    if (connection && connection.state === lib.connection.STATE.RESPONDED) {
        log.debug('received authcrypted message, updating state to COMPLETE');
        connection.state = lib.connection.STATE.COMPLETE;
        await ConnectionService.save(wallet, connection);
    }
}

/**
 *
 * @param {*} to recipient
 * @param {*} msg message
 * @return {object} msg wrapped in forward message
 */
function forward(to, msg) {
    return {
        '@type': FORWARD_TYPE,
        to,
        msg
    };
}

/**
 * Wrap in forward messages and pack-encrypt
 * @param {wallet} wallet
 * @param {object} message
 * @param {object} target
 * @return {string} packed and wrapped message
 */
async function wrapMessage(wallet, message, target) {
    let packed = await lib.crypto.packMessage(wallet, message, target.recipientKeys, target.senderKey);
    let recipient = target.recipientKeys[0];
    for (const key of target.routingKeys) {
        packed = await lib.crypto.packMessage(wallet, forward(recipient, lib.crypto.b64encode(packed)), [key]);
        recipient = key;
    }
    return packed;
}

/**
 * Unwrap and unpack message
 * @param {object} message
 * @return {object} unpacked message without envelopes
 */
async function unwrapMessage(message) {
    let unpacked = await lib.crypto.unpackMessage(domainWallet, message);
    const wallet = await getWalletFromKey(unpacked.message.to);
    unpacked = await lib.crypto.unpackMessage(wallet, unpacked.message.msg);
    unpacked = await lib.crypto.unpackMessage(wallet, unpacked.message.msg);
    return [wallet, unpacked];
}

/**
 * Wrap in forward messages and encrypt
 * Does not support multiple recipients (only first recipientKey is used)
 * Does support wrapping in forward message for routing and endpoint
 * @param {wallet} wallet
 * @param {object} message
 * @param {object} target
 * @return {string} legacy anoncrypted and enveloped message
 */
async function wrapMessageAnon(wallet, message, target) {
    log.debug('wrapMessageAnon', wallet, message, target);
    let packed = target.senderKey
        ? await lib.crypto.authCrypt(wallet.handle, target.senderKey, target.recipientKeys[0], message)
        : await lib.crypto.anonCrypt(target.recipientKeys[0], message);
    let recipient = target.recipientKeys[0];
    for (const key of target.routingKeys) {
        packed = await lib.crypto.anonCrypt(key, forward(recipient, packed));
        recipient = key;
    }
    return { message: packed };
}

/**
 * Unwrap and decrypt message
 * @param {object} body
 * @return {object} decrypted message without envelopes
 */
async function unwrapMessageAnon(body) {
    const endpointKey = await domainWallet.getServiceEndpointKey();
    let unpacked = await lib.crypto.anonDecryptJSON(domainWallet.handle, endpointKey, body.message);
    const wallet = await getWalletFromKey(unpacked.to);
    unpacked = await lib.crypto.anonDecryptJSON(wallet.handle, unpacked.to, unpacked.msg);
    const recipientVk = unpacked.to;
    try {
        const [senderVk, decryptedMessage] = await lib.crypto.authDecryptJSON(wallet.handle, recipientVk, unpacked.msg);
        unpacked = {
            sender_verkey: senderVk,
            recipient_verkey: recipientVk,
            message: decryptedMessage
        };
    } catch (err) {
        log.debug('auth decrypt failed, trying to anon decrypt', err);
        unpacked = await lib.crypto.anonDecryptJSON(wallet.handle, recipientVk, unpacked.msg);
        unpacked = {
            recipient_verkey: recipientVk,
            message: unpacked
        };
    }
    return [wallet, unpacked];
}
