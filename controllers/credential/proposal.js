/**
 * Credential Proposal Controller
 */
'use strict';

const lib = require('../../lib');
const log = require('../../log');
const Mongoose = require('../../db');
const { MessageService, ConnectionService } = require('../../services');
const APIResult = require('../../util/api-result');

const Message = Mongoose.model('Message');
const MESSAGE_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/propose-credential';
const PROPOSAL_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/credential-preview';

module.exports = exports = {};

exports.MESSAGE_TYPE = MESSAGE_TYPE;
exports.PROPOSAL_TYPE = PROPOSAL_TYPE;

exports.list = async wallet => {
    return await Message.find({
        wallet: wallet.id,
        type: MESSAGE_TYPE
    }).exec();
};

exports.create = async (wallet, theirDid, comment = '', credentialProposal = {}, schemaId, credentialDefinitionId) => {
    const conn = await ConnectionService.findOne(wallet, { theirDid });
    if (!conn && ![lib.connection.STATE.RESPONDED, lib.connection.STATE.COMPLETE].includes(conn.state)) {
        throw APIResult.badRequest('no usable connection with given did');
    }

    credentialProposal['@type'] = PROPOSAL_TYPE;
    const proposal = {
        '@id': await lib.crypto.generateId(),
        '@type': MESSAGE_TYPE,
        comment,
        credential_proposal: credentialProposal
    };
    if (schemaId) {
        proposal['schema_id'] = schemaId;
    }
    if (credentialDefinitionId) {
        proposal['cred_def_id'] = credentialDefinitionId;
    }

    const message = await new Message({
        wallet: wallet.id,
        messageId: proposal['@id'],
        threadId: proposal['@id'],
        type: proposal['@type'],
        senderDid: conn.myDid,
        recipientDid: conn.theirDid,
        message: proposal
    }).save();

    MessageService.send(wallet, proposal, conn.endpoint);

    return message;
};

exports.retrieve = async (wallet, id) => {
    return await Message.findOne({
        _id: id,
        wallet: wallet.id,
        type: MESSAGE_TYPE
    }).exec();
};

exports.remove = async (wallet, id) => {
    const proposal = await exports.retrieve(wallet, id);
    if (proposal) {
        await proposal.remove();
        return true;
    }
    return;
};

exports.handle = async (wallet, message, senderVk, recipientVk) => {
    log.debug('received credential proposal', wallet.id, message);
    const conn = await ConnectionService.findOne(wallet, { myKey: recipientVk, theirKey: senderVk });
    if (!conn) {
        throw APIResult.badRequest('unexpected message');
    }

    // store and wait for further action
    await new Message({
        wallet: wallet.id,
        messageId: message['@id'],
        threadId: message['~thread'] ? message['~thread'].thid : message['@id'],
        type: message['@type'],
        senderDid: conn.theirDid,
        recipientDid: conn.myDid,
        message
    }).save();
};

MessageService.registerHandler(MESSAGE_TYPE, exports.handle);
