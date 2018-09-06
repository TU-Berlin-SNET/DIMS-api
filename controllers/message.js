/**
 * IDChain Agent REST API
 * Message Controller
 */

const indy = require('indy-sdk');
const log = require('../log').log;
const wrap = require('../asyncwrap').wrap;
const pool = require('../pool');
const lib = require('../lib');
const APIResult = require('../api-result');
const Wallet = require('../models/wallet');
const Message = require('../models/message');

const WalletProvider = require('../middleware/walletProvider');
const connection = require('./connection');
const credential = require('./credential');
const proof = require('./proof');

const handlers = {};
handlers[lib.message.messageTypes.CONNECTIONOFFER] = connection.offer.handle;
handlers[lib.message.messageTypes.CONNECTIONREQUEST] = connection.request.handle;
handlers[lib.message.messageTypes.CONNECTIONRESPONSE] = connection.response.handle;
handlers[lib.message.messageTypes.CONNECTIONACKNOWLEDGE] = connection.acknowledgement.handle;
handlers[lib.message.messageTypes.CREDENTIALOFFER] = credential.receiveOffer;
handlers[lib.message.messageTypes.CREDENTIALREQUEST] = credential.receiveRequest;
handlers[lib.message.messageTypes.CREDENTIAL] = credential.receiveCredential;
handlers[lib.message.messageTypes.PROOFREQUEST] = proof.receiveRequest;
handlers[lib.message.messageTypes.PROOF] = proof.receiveProof;

/**
 * Loops through wallets trying to find an applicable one
 * @param {String} encryptedMessage base64-encoded anoncrypted message string
 * @return {any[]} [wallet, decryptedMessage]
 */
async function tryAnonDecrypt(encryptedMessage) {
    // This is one hacky solution to this problem
    let wallet;
    let decryptedMessage;
    const cursor = Wallet.find({}).cursor();
    for (let w = await cursor.next(); w != null; w = await cursor.next()) {
        await WalletProvider.provideHandle(w);
        try {
            decryptedMessage = await lib.crypto.anonDecryptJSON(
                w.handle,
                await indy.keyForLocalDid(w.handle, w.ownDid),
                encryptedMessage
            );
            wallet = w;
            break;
        } catch (err) {
            await WalletProvider.returnHandle(w);
            log.warn(err);
        }
    }
    return [wallet, decryptedMessage];
}

module.exports = {
    list: wrap(async (req, res, next) => {
        let query = { wallet: req.wallet.id };
        if (req.query.type) query.messageType = req.query.type;
        const result = await Message.find(query).exec();
        return next(new APIResult(200, result));
    }),

    retrieve: wrap(async (req, res, next) => {
        const result = await Message.findOne({
            _id: req.params.messageId,
            wallet: req.wallet.id
        }).exec();
        if (!result) {
            return next(APIResult.notFound());
        } else {
            return next(new APIResult(200, result));
        }
    }),

    delete: wrap(async (req, res, next) => {
        const message = await Message.findOne({
            _id: req.params.messageId,
            wallet: req.wallet.id
        }).exec();
        if (!message) {
            return next(APIResult.notFound());
        }
        await message.remove();
        return next(APIResult.noContent());
    }),

    sendMessage: wrap(async (req, res, next) => {
        const wallet = req.wallet;
        const did = req.body.did;
        const message = req.body.message;
        const apiResult = await module.exports.anoncryptSendMessage(wallet, did, message);
        return next(apiResult);
    }),

    receiveMessage: wrap(async (req, res, next) => {
        const apiResult = await module.exports.receiveAnoncryptMessage(req.body.message);
        return next(apiResult);
    }),

    /**
     * Send anoncrypted message, only anoncrypts full message,
     * any additional anon-/authcrypt has to be done before manually
     * @param {Object} wallet
     * @param {String} did recipient did
     * @param {Object} message
     * @return {APIResult} apiresult
     */
    async anoncryptSendMessage(wallet, did, message) {
        let endpointDid = did;

        try {
            const pairwise = await indy.getPairwise(wallet.handle, did);
            if (pairwise) {
                const metadata = JSON.parse(pairwise.metadata);
                endpointDid = metadata.theirEndpointDid || did;
            }
        } catch (err) {
            log.info('no pairwise found ', err);
        }

        let result;
        try {
            result = await lib.message.sendAnoncryptMessage(pool.handle, wallet.handle, endpointDid, message);
        } catch (err) {
            if (err.status && err.response && err.response.text) {
                result = {
                    status: err.status,
                    data: JSON.parse(err.response.text).message
                };
            } else {
                log.err(err);
                result = {
                    status: 500,
                    data: { message: 'unexpected error' }
                };
            }
        }
        return new APIResult(result.status, result.data);
    },

    /**
     * Anondecrypt message and forward to its handler
     * @param {String} encryptedMessage anoncrypted message
     * @return {APIResult} apiresult
     */
    async receiveAnoncryptMessage(encryptedMessage) {
        const [wallet, message] = await tryAnonDecrypt(encryptedMessage);
        if (!wallet || !message) {
            return new APIResult(400, { message: 'could not decrypt' });
        }

        const handler = handlers[message.type];
        try {
            if (handler) {
                await handler(wallet, message);
                return APIResult.accepted();
            }
            return APIResult.badRequest('unknown message type ' + message.type);
        } catch (err) {
            if (err instanceof APIResult) {
                return err;
            }
            return APIResult.create(err.status || 500, err.message || null);
        } finally {
            await WalletProvider.returnHandle(wallet);
        }
    }
};
