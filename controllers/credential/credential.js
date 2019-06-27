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

const REQUEST_MESSAGE_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/request-credential';
const CREDENTIAL_MESSAGE_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/issue-credential';

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
     * @param {string} comment
     * @param {(string | object)} credentialRequest _id or doc (as stored in database)
     * @param {object} [values] credential values key-value object
     * @return {Promise<Message>}
     */
    async create(wallet, comment = '', credentialRequest, values = {}) {
        if (typeof credentialRequest === 'string') {
            credentialRequest = await Message.findTypeById(wallet, credentialRequest, REQUEST_MESSAGE_TYPE).exec();
        }
        if (!credentialRequest) {
            throw APIResult.badRequest('no applicable credential request found');
        }
        const connection = await ConnectionService.findOne(wallet, {
            myDid: credentialRequest.recipientDid,
            theirDid: credentialRequest.senderDid
        });
        if (!connection) {
            // request is probably a request we sent instead of received
            throw APIResult.badRequest('no applicable credential request found');
        }

        // merge all possibly provided values or create empty object
        values = Object.assign(
            {},
            values,
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

        // find credential definition
        const credDefId = credentialRequest.meta.offer.cred_def_id;
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

        const id = await lib.crypto.generateId();
        const message = {
            '@id': id,
            '@type': CREDENTIAL_MESSAGE_TYPE,
            comment,
            '~thread': { thid: credentialRequest.threadId },
            'credentials~attach': [
                {
                    '@id': id + '-1',
                    'mime-type': 'application/json',
                    data: { base64: lib.crypto.b64encode(credential) }
                }
            ]
        };

        const doc = await new Message({
            wallet: wallet.id,
            messageId: id,
            threadId: credentialRequest.threadId,
            type: message['@type'],
            senderDid: connection.myDid,
            recipientDid: connection.theirDid,
            message,
            meta
        }).save();
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
     * @param {string} senderVk
     * @param {string} recipientVk
     */
    async handle(wallet, message, senderVk, recipientVk) {
        log.debug('credential received');
        const connection = await ConnectionService.findOne(wallet, { myKey: recipientVk, theirKey: senderVk });
        if (!connection) {
            log.warn('received credential but there is no connection?');
            return;
        }
        const credential = JSON.parse(lib.crypto.b64decode(message['credentials~attach'][0].data.base64));
        const credentialRequest = await Message.findOne({
            wallet: wallet.id,
            threadId: message['~thread'].thid,
            type: REQUEST_MESSAGE_TYPE
        }).exec();
        if (!credentialRequest || credentialRequest.senderDid !== connection.myDid) {
            throw APIResult.badRequest('no corresponding credential request found');
        }
        const [, credentialDefinition] = await lib.ledger.getCredDef(connection.myDid, credential.cred_def_id);

        let revocRegDefinition = null;
        if (credential.rev_reg_id) {
            log.debug('retrieving revocation registry', credential.rev_reg_id);
            [, revocRegDefinition] = await lib.ledger.getRevocRegDef(connection.myDid, credential.rev_reg_id);
        }

        await lib.sdk.proverStoreCredential(
            wallet.handle,
            null, // credId
            credentialRequest.meta.requestMeta,
            credential,
            credentialDefinition,
            revocRegDefinition
        );
    }
};

MessageService.registerHandler(CREDENTIAL_MESSAGE_TYPE, module.exports.handle);
