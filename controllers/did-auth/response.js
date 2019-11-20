/**
 * DID Auth Response Controller
 */
'use strict';

const log = require('../../log').log;
const lib = require('../../lib');
const Mongoose = require('../../db');
const APIResult = require('../../util/api-result');

const Message = Mongoose.model('Message');

const REQUEST_TYPE = lib.message.messageTypes.DIDAUTHREQUEST;
const RESPONSE_TYPE = lib.message.messageTypes.DIDAUTHRESPONSE;

module.exports = exports = {};

exports.list = async wallet => {
    return Message.find({
        wallet: wallet.id,
        type: RESPONSE_TYPE
    }).exec();
};

exports.retrieve = async (wallet, id) => {
    return Message.findTypeById(wallet, id, RESPONSE_TYPE).exec();
};

exports.remove = async (wallet, id) => {
    const data = await exports.retrieve(wallet, id);
    if (data) {
        await data.remove();
    }
    return data;
};

exports.create = async (wallet, didauthRequest) => {
    const pairwise = await ensurePairwise(wallet, didauthRequest);
    await ensureSignature(wallet, pairwise, didauthRequest);

    const response = await lib.didauth.buildResponse(wallet, pairwise, didauthRequest);
    const message = await Message.store(
        wallet.id,
        response.id,
        response.type,
        response.origin,
        pairwise['their_did'],
        response
    );
    await lib.message.sendAuthcrypt(wallet.handle, pairwise['their_did'], response);

    return message;
};

exports.handle = async (wallet, message) => {
    log.debug('received did-auth response');
    const pairwise = await ensurePairwise(wallet, message);

    const innerMessage = await lib.message.authdecrypt(wallet.handle, message.origin, message.message);
    message.message = innerMessage;

    await ensureSignature(wallet, pairwise, message);

    const didauthRequest = await Message.findOne({
        wallet: wallet.id,
        messageId: message.id,
        type: REQUEST_TYPE,
        senderDid: pairwise['my_did']
    }).exec();
    if (!didauthRequest) {
        throw APIResult.badRequest('no matching did auth request');
    }
    await didauthRequest.remove();

    const requestData = await lib.crypto.unwrapSigField(didauthRequest.message.message);
    const responseData = await lib.crypto.unwrapSigField(message.message);
    if (requestData.nonce !== responseData.nonce) {
        throw APIResult.badRequest('invalid nonce');
    }
    const meta = didauthRequest.meta || {};
    meta.isValid = true;
    meta.content = responseData;

    await Message.store(wallet.id, message.id, message.type, pairwise['their_did'], pairwise['my_did'], message, meta);
};

/**
 * Ensure pairwise with message.origin exists, throw otherwise
 * @param {Wallet} wallet
 * @param {Object} message
 * @return {Promise<Object>} pairwise
 */
async function ensurePairwise(wallet, message) {
    if (!(await lib.pairwise.exists(wallet.handle, message.origin))) {
        throw APIResult.badRequest('no pairwise found');
    }
    const pairwise = await lib.pairwise.retrieve(wallet.handle, message.origin);
    return pairwise;
}

/**
 * Ensure signer matches pairwise key and signature is valid,
 * throw otherwise
 * @param {Wallet} wallet
 * @param {Object} pairwise
 * @param {Object} message
 * @return {Promise<Boolean>}
 */
async function ensureSignature(wallet, pairwise, message) {
    const theirKey = await lib.did.keyOf(wallet, pairwise['their_did']);
    if (message.message.signer !== theirKey) {
        throw APIResult.badRequest('signer key mismatch');
    }
    if (!(await lib.crypto.sigFieldIsValid(message.message))) {
        throw APIResult.badRequest('invalid signature');
    }
    return true;
}
