/**
 * IDChain Agent REST API
 * Credential Controller
 */
'use strict';

const agent = require('superagent');

const lib = require('../../lib');
const log = require('../../log').log;
const Mongoose = require('../../db');
const APIResult = require('../../util/api-result');

const Message = Mongoose.model('Message');
const CredDef = Mongoose.model('CredentialDefinition');
const RevReg = Mongoose.model('RevocationRegistry');
const Services = require('../../services');

const ConnectionService = Services.ConnectionService;
const MessageService = Services.MessageService;

const CREDENTIAL_MESSAGE_TYPE = 'urn:sovrin:agent:message_type:sovrin.org/credential';

module.exports = {
    /**
     * List credentials issued and sent with current wallet
     * @param {Wallet} wallet
     * @param {object} query additional query parameters to filter by, e.g. recipientDid
     * @return {Promise<Message[]>}
     */
    async list(wallet, query = {}) {
        const search = Message.find({
            wallet: wallet._id,
            type: CREDENTIAL_MESSAGE_TYPE
        });
        if (query) {
            search.find(query);
        }
        return search.exec();
    },

    /**
     * Issue a credential, i.e. create and send a credential
     * @param {Wallet} wallet
     * @param {(string | object)} credentialRequest _id or doc (as stored in database)
     * @param {object} [values] credential values key-value object
     * @return {Promise<Message>}
     */
    async create(wallet, credentialRequest, values) {
        if (typeof credentialRequest === 'string') {
            credentialRequest = await Message.findTypeById(
                wallet,
                credentialRequest,
                lib.message.messageTypes.CREDENTIALREQUEST
            ).exec();
        }
        if (!credentialRequest || credentialRequest.senderDid === wallet.ownDid) {
            throw APIResult.badRequest('invalid credential request or no applicable credential request found');
        }

        // merge all possibly provided values or create empty object
        values = Object.assign(
            {},
            values || {},
            credentialRequest.meta.credentialLocation
                ? (await agent.get(credentialRequest.meta.credentialLocation)).body
                : {}
        );
        const keys = Object.keys(values);
        if (!keys) {
            throw APIResult.badRequest('missing values and/or credential values location');
        }
        // reduce values to credential format, e.g.
        // credentialValues = { "firstname": { "raw": "Alice", "encoded": "encodedValue" } }
        const credentialValues = Object.entries(values).reduce((accu, [key, value]) => {
            accu[key] = { raw: value.toString(), encoded: lib.credential.encode(value) };
            return accu;
        }, {});

        const connection = await ConnectionService.findOne(wallet, { theirDid: credentialRequest.message.origin });

        // find credential definition
        const credDefId = credentialRequest.message.message['cred_def_id'];
        const credDef = await CredDef.findOne({ credDefId: credDefId }).exec();
        if (!credDef) {
            throw Error(credDefId + ' : credential definition not found');
        }

        // optionally: find revocation registry
        const revocRegDefId = credDef.revocRegDefId;

        let revocReg = null;
        if (revocRegDefId) {
            revocReg = await RevReg.findOne({ revocRegDefId: revocRegDefId }).exec();
            if (!revocReg) {
                throw Error('Revocation registry not found for ' + revocRegDefId);
            }
        }

        const [credential, credRevocId, revocRegDelta] = await lib.credential.issue(
            wallet.handle,
            wallet.ownDid,
            credentialRequest,
            credentialValues,
            revocReg
        );

        // put revocation info in meta if available
        const meta = revocRegDefId ? { revocRegDefId, credRevocId, revocRegDelta } : null;

        const message = {
            id: credentialRequest.messageId,
            origin: connection.myDid,
            type: CREDENTIAL_MESSAGE_TYPE,
            message: credential
        };
        const doc = await Message.store(
            wallet.id,
            message.id,
            message.type,
            wallet.ownDid,
            credentialRequest.message.origin,
            message,
            meta
        );
        await MessageService.send(wallet, message, connection.endpoint);
        await credentialRequest.remove();

        return doc;
    },

    /**
     * Retrieve a credential issued and sent with current wallet
     * @param {Wallet} wallet
     * @param {String} id credential id as stored in DB
     * @return {Promise<Credential>}
     */
    async retrieve(wallet, id) {
        return Message.findOne({
            _id: id,
            wallet: wallet._id,
            type: CREDENTIAL_MESSAGE_TYPE
        }).exec();
    },

    /**
     * Revoke a credential
     * @param {Wallet} wallet
     * @param {String} id credential message id as stored in db
     * @return {Promise<Message>}
     */
    async revoke(wallet, id) {
        const message = await Message.findTypeById(wallet, id, CREDENTIAL_MESSAGE_TYPE).exec();
        if (!message) {
            return null;
        }

        const revocRegDefId = message.meta.revocRegDefId;
        const credRevocId = message.meta.credRevocId;
        let revocReg = null;
        if (revocRegDefId) {
            revocReg = await RevReg.findOne({ revocRegDefId: revocRegDefId }).exec();
        }

        // returns revoc_registry_delta
        return await lib.credential.revoke(wallet.handle, wallet.ownDid, credRevocId, revocReg);
    },

    /**
     * Handle reception of credential through agent to agent communication
     * @param {Wallet} wallet
     * @param {object} message
     */
    async handle(wallet, message) {
        log.debug('credential received');
        let credential = message.message;
        log.debug('credential', credential);
        const credentialRequest = await Message.findTypeByMessageId(
            wallet,
            message.id,
            lib.message.messageTypes.CREDENTIALREQUEST
        ).exec();
        if (!credentialRequest || credentialRequest.senderDid !== wallet.ownDid) {
            throw APIResult.badRequest('no corresponding credential request found');
        }
        const connection = await ConnectionService.findOne(wallet, { theirDid: message.origin });
        const [, credentialDefinition] = await lib.ledger.getCredDef(connection.myDid, message.message.cred_def_id);

        let revocRegDefinition = null;
        if (credential.rev_reg_id)
            [, revocRegDefinition] = await lib.ledger.getRevocRegDef(connection.myDid, credential.rev_reg_id);
        await lib.sdk.proverStoreCredential(
            wallet.handle,
            null, // credId
            credentialRequest.meta,
            message.message,
            credentialDefinition,
            revocRegDefinition
        );
    }
};

MessageService.registerHandler(CREDENTIAL_MESSAGE_TYPE, module.exports.handle);
