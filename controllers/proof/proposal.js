/**
 * Proof Proposal Controller
 */
'use strict';

const lib = require('../../lib');
const log = require('../../log');
const Mongoose = require('../../db');
const { MessageService, ConnectionService } = require('../../services');
const APIResult = require('../../util/api-result');

const Message = Mongoose.model('Message');
const MESSAGE_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/present-proof/1.0/propose-presentation';
const PREVIEW_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/present-proof/1.0/presentation-preview';

module.exports = exports = {};

exports.MESSAGE_TYPE = MESSAGE_TYPE;
exports.PREVIEW_TYPE = PREVIEW_TYPE;

exports.list = async wallet => {
    return await Message.find({
        wallet: wallet.id,
        type: MESSAGE_TYPE
    }).exec();
};

exports.create = async (wallet, theirDid, comment = '', attributes = [], predicates = []) => {
    const conn = await ConnectionService.findOne(wallet, { theirDid });
    if (!conn && ![lib.connection.STATE.RESPONDED, lib.connection.STATE.COMPLETE].includes(conn.state)) {
        throw APIResult.badRequest('no usable connection with given did');
    }

    const proposal = {
        '@id': await lib.crypto.generateId(),
        '@type': MESSAGE_TYPE,
        comment,
        presentation_proposal: {
            '@type': PREVIEW_TYPE,
            attributes,
            predicates
        }
    };

    const errors = await validateProposal(proposal.presentation_proposal);
    if (errors.length > 0) {
        throw APIResult.badRequest(
            'invalid request. ' + errors.map(v => v.name + ' is not included in cred def ' + v.cred_def_id).join(', ')
        );
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
    log.debug('received proof proposal', wallet.id, message);
    const conn = await ConnectionService.findOne(wallet, { myKey: recipientVk, theirKey: senderVk });
    if (!conn) {
        throw APIResult.badRequest('unexpected message, no connection');
    }

    const errors = await validateProposal(message.presentation_proposal);
    if (errors.length > 0) {
        throw APIResult.badRequest(
            'invalid request. ' + errors.map(v => v.name + ' is not included in cred def ' + v.cred_def_id).join(', ')
        );
    }

    // store and wait for further action
    await new Message({
        wallet: wallet.id,
        type: message['@type'],
        messageId: message['@id'],
        threadId: message['~thread'] ? message['~thread'].thid : message['@id'],
        senderDid: conn.theirDid,
        recipientDid: conn.myDid,
        message
    }).save();
};

/**
 * Validate presentation_proposal object
 * Checks if attributes are included in cred defs' schemas
 * @param {object} presentationProposal presentation_proposal
 * @return {Promise<Array>} array of failing attributes/predicates
 */
async function validateProposal(presentationProposal) {
    const attrs = [...presentationProposal.attributes, ...presentationProposal.predicates];
    const credDefIds = [...new Set(attrs.filter(v => !!v.cred_def_id).map(v => v.cred_def_id))];
    const credDefs = await credDefIds.reduce(async (accuPromise, value) => {
        const accu = await accuPromise;
        const [credDefId, credDef] = await lib.ledger.getCredDef(undefined, value);
        // FIXME for some reason credDef has a seqNo in schemaId field,
        // this might change in later versions, so be aware
        const schemaTxn = await lib.ledger.getTxn(undefined, undefined, parseInt(credDef.schemaId, 10));
        const schema = schemaTxn.result.data.txn.data.data;
        accu[credDefId] = { credDef, schema };
        return accu;
    }, Promise.resolve({}));

    // check for all attributes with restrictions on credential definitions
    // if an attribute with the same name is included in the attribute list of the schema
    // the credential definition is based on, return those that are NOT as an array of errors
    return attrs.filter(v => v.cred_def_id && !credDefs[v.cred_def_id].schema.attr_names.includes(v.name));
}

MessageService.registerHandler(MESSAGE_TYPE, exports.handle);
