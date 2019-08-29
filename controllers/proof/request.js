/**
 * IDChain Agent REST API
 * Proof Request Controller
 */
'use strict';

const Mustache = require('mustache');
const lib = require('../../lib');
const log = require('../../log');
const Mongoose = require('../../db');
const APIResult = require('../../util/api-result');
const ProofController = require('./proof');

const Proof = Mongoose.model('Proof');
const Message = Mongoose.model('Message');
const ProofRequestTemplate = Mongoose.model('ProofRequestTemplate');
const Services = require('../../services');

const ConnectionService = Services.ConnectionService;
const MessageService = Services.MessageService;

const PROPOSAL_MESSAGE_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/present-proof/1.0/propose-presentation';
const REQUEST_MESSAGE_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/present-proof/1.0/request-presentation';

module.exports = {
    REQUEST_MESSAGE_TYPE,

    /**
     * List proof requests belonging to wallet (sent or received)
     * @param {Wallet} wallet
     * @return {Promise<Message[]>}
     */
    async list(wallet) {
        return Message.find({
            wallet: wallet.id,
            type: REQUEST_MESSAGE_TYPE
        }).exec();
    },

    /**
     * Create and send a proof request
     * @param {Wallet} wallet
     * @param {string} recipientDid
     * @param {string} [comment]
     * @param {(string | object)} proofRequest _id of proof request template or proof request object
     * @param {object} [templateValues] values to use for rendering the template
     * @param {strign} [proofProposalId]
     * @return {Promise<Message>}
     */
    async create(wallet, recipientDid, comment = '', proofRequest, templateValues, proofProposalId) {
        const connection = await ConnectionService.findOne(wallet, { theirDid: recipientDid });
        if (
            !connection ||
            ![lib.connection.STATE.RESPONDED, lib.connection.STATE.COMPLETE].includes(connection.state)
        ) {
            throw APIResult.badRequest('invalid recipientDid, no applicable connection found');
        }
        if (proofRequest && proofProposalId) {
            throw APIResult.badRequest('Invalid Request. Specify either proof request OR proof proposal, not both.');
        }

        let proofProposal;
        if (proofProposalId) {
            proofProposal = await Message.findOne({
                _id: proofProposalId,
                wallet: wallet.id,
                type: PROPOSAL_MESSAGE_TYPE
            }).exec();
            if (!proofProposal || proofProposal.senderDid !== recipientDid) {
                throw APIResult.badRequest('proof proposal not applicable or not found');
            }

            // reduce to format specified for presentation request
            const requestedAttributes = proofProposal.message.presentation_proposal.attributes.reduce((accu, value) => {
                const field = { name: value.name };
                // add restrictions field ONLY if there is one, an empty array
                // causes a CommonInvalidState error when trying to find credentials for proof
                if (value.cred_def_id) {
                    field.restrictions = [{ cred_def_id: value.cred_def_id }];
                }
                accu[value.name] = field;
                return accu;
            }, {});

            const requestedPredicates = proofProposal.message.presentation_proposal.predicates.reduce((accu, value) => {
                const field = {
                    name: value.name,
                    p_type: value.predicate,
                    p_value: value.threshold
                };
                if (value.cred_def_id) {
                    field.restrictions = [{ cred_def_id: value.cred_def_id }];
                }
                accu[value.name] = field;
                return accu;
            }, {});

            proofRequest = {
                name: proofProposal.messageId,
                version: '1.0',
                requested_attributes: requestedAttributes,
                requested_predicates: requestedPredicates
            };
        }

        // proofRequest === string -> it is a template _id so retrieve it
        if (typeof proofRequest === 'string' && !proofProposalId) {
            const templateDoc = await ProofRequestTemplate.findOne({
                _id: proofRequest,
                wallet: wallet.id
            }).exec();
            proofRequest = templateDoc ? JSON.parse(Mustache.render(templateDoc.template, templateValues)) : null;
        }
        if (!proofRequest) {
            throw APIResult.badRequest('invalid proof request or no applicable proof request template found');
        }
        if (!proofRequest.nonce) {
            proofRequest.nonce = await lib.crypto.getNonce();
        }

        const id = await lib.crypto.generateId();
        const message = {
            '@id': id,
            '@type': REQUEST_MESSAGE_TYPE,
            '~thread': { thid: proofProposal ? proofProposal.threadId : id },
            comment,
            'request_presentations~attach': [
                {
                    '@id': id + '-1',
                    'mime-type': 'application/json',
                    data: { base64: lib.crypto.b64encode(proofRequest) }
                }
            ]
        };

        // create placeholder for expected proof, this will allow for checking the status later on
        const proof = await new Proof({
            wallet: wallet.id,
            did: recipientDid
        }).save();

        const meta = { proofId: proof.id, proofRequest };
        const doc = await new Message({
            wallet: wallet.id,
            type: message['@type'],
            messageId: id,
            threadId: message['~thread'].thid,
            senderDid: connection.myDid,
            recipientDid,
            message,
            meta
        }).save();

        await MessageService.send(wallet, message, connection.endpoint);

        return doc;
    },

    /**
     * Retrieve a proof request
     * @param {Wallet} wallet
     * @param {String} id request _id (not message.id or nonce)
     * @return {Promise<Message>}
     */
    async retrieve(wallet, id) {
        return Message.findTypeById(wallet, id, REQUEST_MESSAGE_TYPE).exec();
    },

    /**
     * Remove a proof request
     * @param {Wallet} wallet
     * @param {String} id request _id (not message.id or nonce)
     * @return {Promise<Message>}
     */
    async remove(wallet, id) {
        const request = await module.exports.retrieve(wallet, id);
        if (request) {
            await request.remove();
        }
        return request;
    },

    /**
     * Handle reception of proof request through agent to agent communication
     * @param {Wallet} wallet
     * @param {object} message
     * @param {string} senderVk
     * @param {string} recipientVk
     */
    async handle(wallet, message, senderVk, recipientVk) {
        log.debug('received proof request');
        const connection = await ConnectionService.findOne(wallet, { myKey: recipientVk, theirKey: senderVk });
        if (!connection) {
            log.warn('received proof request but there is no connection?');
            return;
        }

        const proofRequest = JSON.parse(lib.crypto.b64decode(message['request_presentations~attach'][0].data.base64));
        const meta = { proofRequest };
        const proofRequestDoc = await new Message({
            wallet: wallet.id,
            messageId: message['@id'],
            type: message['@type'],
            threadId: message['~thread'].thid,
            senderDid: connection.theirDid,
            recipientDid: connection.myDid,
            message,
            meta
        }).save();

        // auto-accept and respond if 1) there is a proposal, 2) proposal and request match,
        // and 3) proof can be created with available values,
        // i.e. each attribute is either restricted to a credential or a value is present
        const proofProposal = await Message.findOne({
            wallet: wallet.id,
            type: PROPOSAL_MESSAGE_TYPE,
            threadId: message['~thread'].thid,
            senderDid: connection.myDid,
            recipientDid: connection.theirDid
        }).exec();
        if (
            proofProposal &&
            proofProposal.message.presentation_proposal.attributes.every(
                v => !!v.cred_def_id || typeof v.value !== 'undefined'
            ) &&
            isMatchingRequest(proofProposal.message.presentation_proposal, proofRequest)
        ) {
            log.debug('proof proposal and request check passed, auto-accepting');
            await proofProposal.remove();
            const values = proofProposal.message.presentation_proposal.attributes.reduce((accu, value) => {
                if (!value.cred_def_id) {
                    accu[value.name] = value.value;
                }
                return accu;
            }, {});
            ProofController.create(wallet, proofRequestDoc, 'auto-response', values);
        }
    }
};

/**
 * Check if proposal and request match
 * @param {array} proposal
 * @param {object} request
 * @return {boolean} result
 */
function isMatchingRequest(proposal, request) {
    const attributesMatch =
        proposal.attributes.length === Object.keys(request.requested_attributes).length &&
        proposal.attributes.every(
            attr =>
                !!Object.values(request.requested_attributes).find(
                    v =>
                        v.name === attr.name && attr.cred_def_id
                            ? v.restrictions.length === 1 && v.restrictions[0].cred_def_id === attr.cred_def_id
                            : true
                )
        );
    const predicatesMatch =
        proposal.predicates.length === Object.keys(request.requested_predicates).length &&
        proposal.predicates.every(
            attr =>
                !!Object.values(request.requested_predicates).find(
                    v =>
                        v.name === attr.name &&
                        v.restrictions.length === 1 &&
                        v.restrictions[0].cred_def_id === attr.cred_def_id &&
                        v.p_type === attr.predicate &&
                        v.p_value === attr.threshold
                )
        );
    log.debug('isMatchingRequest', attributesMatch, predicatesMatch);
    return attributesMatch && predicatesMatch;
}

MessageService.registerHandler(REQUEST_MESSAGE_TYPE, module.exports.handle);
