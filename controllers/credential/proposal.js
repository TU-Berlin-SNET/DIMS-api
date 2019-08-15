/**
 * Credential Proposal Controller
 */
'use strict';

const lib = require('../../lib');
const log = require('../../log');
const Mongoose = require('../../db');
const { MessageService, ConnectionService } = require('../../services');
const APIResult = require('../../util/api-result');

const CredentialDefinition = Mongoose.model('CredentialDefinition');
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
    if (schemaId && credentialDefinitionId) {
        const [, schema] = await lib.ledger.getSchema(conn.myDid, schemaId);
        const [, creddef] = await lib.ledger.getCredDef(conn.myDid, credentialDefinitionId);
        // for some reason the schemaId in the credential definition
        // contains the seqNo instead of the schema id, also: seqNo is Number, schemaId is string
        if (schema.seqNo !== parseInt(creddef.schemaId, 10)) {
            throw APIResult.badRequest('schema mismatch: credential definition not based on given schema');
        }
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
        throw APIResult.badRequest('unexpected message, no connection');
    }

    let creddef;
    let attributes = [] || (message.credential_proposal && message.credential_proposal);
    const meta = {};

    if (message.schema_id) {
        const [, schema] = await lib.ledger.getSchema(conn.myDid, message.schema_id);
        if (!schema) {
            throw APIResult.badRequest('invalid schemaId');
        }
        for (const name in attributes.map(v => v.name)) {
            if (!schema.attrNames.includes(name)) {
                throw APIResult.badRequest('invalid credential preview, %s not in schema', name);
            }
        }
        log.debug('schema exists and includes attributes in proposal');
        meta.schema = schema;
    }

    if (message.cred_def_id) {
        creddef = await CredentialDefinition.findOne({
            wallet: wallet.id,
            credDefId: message.cred_def_id
        }).exec();
        if (!creddef) {
            throw APIResult.badRequest('invalid cred def id');
        }
        if (message.schema_id && meta.schema.seqNo !== parseInt(creddef.data.schemaId, 10)) {
            throw APIResult.badRequest('schema/creddef mismatch: credential definition not based on schema');
        }
        meta.credentialDefinition = creddef.data;
    }

    // store and wait for further action
    await new Message({
        wallet: wallet.id,
        type: message['@type'],
        messageId: message['@id'],
        threadId: message['~thread'] ? message['~thread'].thid : message['@id'],
        senderDid: conn.theirDid,
        recipientDid: conn.myDid,
        message,
        meta
    }).save();
};

MessageService.registerHandler(MESSAGE_TYPE, exports.handle);
