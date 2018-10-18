/**
 * IDChain Agent REST API
 * Credential Controller
 */
'use strict';

const agent = require('superagent');

const lib = require('../../lib');
const log = require('../../log').log;
const pool = require('../../pool');
const Mongoose = require('../../db');
const APIResult = require('../../api-result');

const Message = Mongoose.model('Message');
const messageTypes = lib.message.messageTypes;

module.exports = {
    /**
     * List credentials in wallet
     * @param {Wallet} wallet
     * @param {object} query
     * @return {Promise<Message[]>}
     */
    async list(wallet, query = {}) {
        const [searchHandle, totalCount] = await lib.sdk.proverSearchCredentials(wallet.handle, query);
        const credentials = await lib.sdk.proverFetchCredentials(searchHandle, totalCount);
        return credentials;
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
                messageTypes.CREDENTIALREQUEST
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

        const pairwise = await lib.pairwise.getPairwise(wallet.handle, credentialRequest.message.origin);
        const [credential, credRevocId, revocRegDelta] = await lib.sdk.issuerCreateCredential(
            wallet.handle,
            credentialRequest.meta.offer,
            credentialRequest.message.message,
            credentialValues,
            null,
            null
        );

        const meta = {
            credRevocId: credRevocId,
            revocRegDelta: revocRegDelta
        };
        const message = {
            id: credentialRequest.messageId,
            origin: pairwise['my_did'],
            type: messageTypes.CREDENTIAL,
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
        await lib.message.sendAuthcryptMessage(wallet.handle, credentialRequest.message.origin, message);
        await credentialRequest.remove();

        return doc;
    },

    /**
     * Retrieve a credential
     * @param {Wallet} wallet
     * @param {String} id credential id as stored in wallet
     * @return {Promise<Credential>}
     */
    async retrieve(wallet, id) {
        return lib.sdk.proverGetCredential(wallet.handle, id);
    },

    /**
     * Handle reception of credential through agent to agent communication
     * @param {Wallet} wallet
     * @param {object} message
     */
    async handle(wallet, message) {
        log.debug('credential received');
        const innerMessage = await lib.message.authdecryptMessage(wallet.handle, message.origin, message.message);
        message.message = innerMessage;

        const credentialRequest = await Message.findTypeByMessageId(
            wallet,
            message.id,
            messageTypes.CREDENTIALREQUEST
        ).exec();
        if (!credentialRequest || credentialRequest.senderDid !== wallet.ownDid) {
            throw APIResult.badRequest('no corresponding credential request found');
        }
        const pairwise = await lib.pairwise.getPairwise(wallet.handle, message.origin);
        const [, credentialDefinition] = await pool.getCredDef(pairwise['my_did'], message.message.cred_def_id);

        await lib.sdk.proverStoreCredential(
            wallet.handle,
            null, // credId
            credentialRequest.meta,
            message.message,
            credentialDefinition,
            null // revRegDef
        );
    }
};
