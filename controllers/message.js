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
handlers[lib.message.messageTypes.CONNECTIONOFFER] = module.exports.storeMessage;
handlers[lib.message.messageTypes.CONNECTIONREQUEST] = module.exports.storeMessage;
handlers[lib.message.messageTypes.CONNECTIONRESPONSE] = connection.response;
handlers[lib.message.messageTypes.CONNECTIONACKNOWLEDGE] = connection.acknowledgement;
handlers[lib.message.messageTypes.CREDENTIALOFFER] = module.exports.storeMessage;
handlers[lib.message.messageTypes.CREDENTIALREQUEST] = module.exports.storeMessage;
handlers[lib.message.messageTypes.CREDENTIAL] = credential.credential;
handlers[lib.message.messageTypes.PROOFREQUEST] = module.exports.storeMessage;
handlers[lib.message.messageTypes.PROOF] = proof.proof;

/**
 * Loops through wallets trying to find an applicable one
 * @param {String} encryptedMessage base64-encoded anoncrypted message string
 * @return {any[]} [wallet, decryptedMessage]
 */
async function tryAnonDecrypt(encryptedMessage) {
    let wallet;
    let decryptedMessage;
    const cursor = Wallet.find({}).cursor();
    for (let w = await cursor.next(); w != null; w = await cursor.next()) {
        await WalletProvider.provideHandle(w);
        try {
            decryptedMessage = await lib.crypto.anonDecrypt(w.handle, w.ownDid, encryptedMessage);
            wallet = w;
            break;
        } catch (err) {
            log.warn(err);
        }
    }
    return [wallet, decryptedMessage];
}

module.exports = {
    sendMessage: wrap(async (req, res, next) => {
        const wallet = req.wallet;
        const did = req.body.did;
        const message = req.body.message;
        let result;
        try {
            result = await lib.message.sendAnoncryptMessage(pool.handle, wallet.handle, did, message);
        } catch (err) {
            result = {
                status: result.status,
                message: JSON.parse(result.response.text)
            };
        }
        log.debug('sendMessage result', result);
        return next(new APIResult(result.status, result.data));
    }),

    receiveMessage: wrap(async (req, res, next) => {
        const [wallet, message] = await tryAnonDecrypt(req.body.message);
        if (!wallet || !message) {
            return next(new APIResult(400, { message: 'could not decrypt' }));
        }

        const handler = handlers[message.type];
        try {
            if (handler) {
                await handler(wallet, message);
                return next(new APIResult(202));
            }
            next(new APIResult(400, { message: 'unknown message type' }));
        } finally {
            await WalletProvider.returnHandle(wallet);
        }
    }),

    async storeMessage(wallet, message) {
        await new Message({
            wallet: wallet,
            messageId: message.id,
            type: message.type,
            message: message
        }).save();
    }
};
