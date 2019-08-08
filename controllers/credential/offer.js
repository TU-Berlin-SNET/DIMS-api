/**
 * IDChain Agent REST API
 * Credential Offer Controller
 */
'use strict';

const log = require('../../log');
const lib = require('../../lib');
const Mongoose = require('../../db');
const APIResult = require('../../util/api-result');
const CredentialProposal = require('./proposal');
const CredentialRequestController = require('./request');

const Message = Mongoose.model('Message');

const Services = require('../../services');

const ConnectionService = Services.ConnectionService;
const MessageService = Services.MessageService;

const PROPOSAL_MESSAGE_TYPE = CredentialProposal.MESSAGE_TYPE;
const OFFER_MESSAGE_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/offer-credential';

module.exports = {
    OFFER_MESSAGE_TYPE,

    /**
     * List credential offers belonging to wallet
     * @param {Wallet} wallet
     * @return {Promise<Message[]>} array of credential offer messages
     */
    async list(wallet) {
        return Message.find({
            wallet: wallet.id,
            type: OFFER_MESSAGE_TYPE
        }).exec();
    },

    /**
     * Create and send a credential offer
     * @param {Wallet} wallet
     * @param {string} comment
     * @param {string} recipientDid
     * @param {string} credDefId
     * @param {string} credentialProposal accept a credential proposal
     * @param {string} [credentialLocation]
     * @return {Promise<Message>} Credential Offer object
     */
    async create(wallet, comment = '', recipientDid, credDefId, credentialProposal, credentialLocation) {
        const connection = await ConnectionService.findOne(wallet, { theirDid: recipientDid });
        let proposal;
        if (credentialProposal) {
            proposal = await Message.findOne({
                _id: credentialProposal,
                type: PROPOSAL_MESSAGE_TYPE,
                wallet: wallet.id,
                senderDid: connection.theirDid
            }).exec();
            if (!proposal) {
                throw APIResult.badRequest('invalid proposal id');
            }
            if (proposal.message.cred_def_id && proposal.message.cred_def_id !== credDefId) {
                throw APIResult.badRequest('credential definition id mismatch');
            }
        }

        const id = await lib.crypto.generateId();
        const credentialOffer = await lib.sdk.issuerCreateCredentialOffer(wallet.handle, credDefId);
        const message = {
            '@id': id,
            '@type': OFFER_MESSAGE_TYPE,
            comment,
            'offers~attach': [
                {
                    '@id': id + '-1',
                    'mime-type': 'application/json',
                    data: {
                        base64: await lib.crypto.b64encode(credentialOffer)
                    }
                }
            ]
        };

        // store and send message
        const meta = {
            offer: credentialOffer
        };
        if (proposal) {
            message['~thread'] = { thid: proposal.threadId };
            meta.proposal = proposal.message;
        }
        if (credentialLocation) {
            meta.credentialLocation = credentialLocation;
        }

        const doc = await new Message({
            wallet: wallet.id,
            messageId: id,
            type: message['@type'],
            senderDid: connection.myDid,
            threadId: message['~thread'] ? message['~thread'].thid : id,
            recipientDid,
            message,
            meta
        }).save();

        await MessageService.send(wallet, message, connection.endpoint);

        return doc;
    },

    /**
     * Retrieve a credential offer
     * @param {Wallet} wallet
     * @param {String} id offer _id (not message.id or nonce)
     * @return {Promise<Message>} credential offer or null
     */
    async retrieve(wallet, id) {
        return Message.findTypeById(wallet, id, OFFER_MESSAGE_TYPE).exec();
    },

    /**
     * Remove a credential offer
     * @param {Wallet} wallet
     * @param {String} id offer _id (not message.id or nonce)
     * @return {Promise<Message>} removed credential offer or null
     */
    async remove(wallet, id) {
        const offer = await module.exports.retrieve(wallet, id);
        if (offer) {
            await offer.remove();
        }
        return offer;
    },

    /**
     * Handle reception of credential offer through agent to agent communication
     * @param {Wallet} wallet
     * @param {object} message credential offer
     * @param {*} senderVk
     * @param {*} recipientVk
     */
    async handle(wallet, message, senderVk, recipientVk) {
        log.debug('received credential offer');
        const connection = await ConnectionService.findOne(wallet, { myKey: recipientVk, theirKey: senderVk });
        if (!connection) {
            log.warn('received credential offer but there is no connection');
            // TODO needs better error handling
            return;
        }

        const decodedOffer = JSON.parse(lib.crypto.b64decode(message['offers~attach'][0].data.base64));
        const meta = { offer: decodedOffer };

        const doc = await new Message({
            wallet: wallet.id,
            messageId: message['@id'],
            type: message['@type'],
            threadId: message['~thread'] ? message['~thread'].thid : message['@id'],
            senderDid: connection.theirDid,
            recipientDid: connection.myDid,
            message,
            meta
        }).save();

        // if offer contains threading information, it might be in response to a previous proposal
        if (message['~thread']) {
            const proposal = await Message.findOne({
                wallet: wallet.id,
                type: PROPOSAL_MESSAGE_TYPE,
                senderDid: connection.myDid,
                recipientDid: connection.theirDid,
                threadId: message['~thread'].thid
            }).exec();

            if (!proposal) {
                return;
            }

            log.debug('credential offer was in response to previous proposal');

            // if both have previews, check if they match
            const previewsMatch =
                proposal.message.credential_proposal && message.credential_preview
                    ? proposal.message.credential_proposal.attributes.every(attr => {
                          const attrInOffer = message.credential_preview.find(v => v.name === attr.name);
                          return ['name', 'mime-type', 'encoding', 'value'].every(v => attr[v] === attrInOffer[v]);
                      })
                    : true;

            // if both have schema ids, check if they match
            const schemaIdsMatch = proposal.message.schema_id
                ? proposal.message.schema_id === decodedOffer.schema_id
                : true;

            // same for cred def ids
            const credDefsMatch = proposal.message.cred_def_id
                ? proposal.message.cred_def_id === decodedOffer.cred_def_id
                : true;

            // if all match, auto-request credentials
            if (previewsMatch && schemaIdsMatch && credDefsMatch) {
                log.debug('credential offer matches previous proposal, auto-requesting..');
                await proposal.remove();
                CredentialRequestController.create(wallet, '', doc.id);
            } else {
                log.debug('credential offer does NOT match previous proposal');
            }
        }
    }
};

MessageService.registerHandler(OFFER_MESSAGE_TYPE, module.exports.handle);
