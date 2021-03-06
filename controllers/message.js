/**
 * IDChain Agent REST API
 * Message Controller
 */

const log = require('../log').log;
const wrap = require('../util/asyncwrap').wrap;
const lib = require('../lib');
const APIResult = require('../util/api-result');
const Wallet = require('../models/wallet');
const Message = require('../models/message');

const WalletProvider = require('../middleware/walletProvider');
const connection = require('./connection/index');
const credential = require('./credential/index');
const proof = require('./proof/index');

const handlers = {};
handlers[lib.message.messageTypes.CONNECTIONOFFER] = connection.offer.handle;
handlers[lib.message.messageTypes.CONNECTIONREQUEST] = connection.request.handle;
handlers[lib.message.messageTypes.CONNECTIONRESPONSE] = connection.response.handle;
handlers[lib.message.messageTypes.CONNECTIONACKNOWLEDGE] = connection.acknowledgement.handle;
handlers[lib.message.messageTypes.CREDENTIALOFFER] = credential.offer.handle;
handlers[lib.message.messageTypes.CREDENTIALREQUEST] = credential.request.handle;
handlers[lib.message.messageTypes.CREDENTIAL] = credential.credential.handle;
handlers[lib.message.messageTypes.PROOFREQUEST] = proof.request.handle;
handlers[lib.message.messageTypes.PROOF] = proof.proof.handle;

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
                await lib.sdk.keyForLocalDid(w.handle, w.ownDid),
                encryptedMessage
            );
            wallet = w;
            break;
        } catch (err) {
            await WalletProvider.returnHandle(w);
            log.warn(err);
        }
    }
    cursor.close();
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
            const pairwise = await lib.pairwise.retrieve(wallet.handle, did);
            endpointDid = pairwise.metadata.theirEndpointDid || did;
        } catch (err) {
            log.info('no pairwise found ', err);
        }

        const [endpoint, endpointVk] = await lib.sdk.getEndpointForDid(wallet.handle, lib.ledger.handle, endpointDid);

        let result;
        try {
            result = await lib.message.sendAnoncrypt(endpointVk, endpoint, message);
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
