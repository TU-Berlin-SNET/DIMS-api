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

const WalletProvider = require('../middleware/walletProvider');
const connection = require('./connection');
const credential = require('./credential');
const proof = require('./proof');

const handlers = {};
handlers[lib.message.messageTypes.CONNECTIONOFFER] = connection.offer;
handlers[lib.message.messageTypes.CONNECTIONREQUEST] = connection.request;
handlers[lib.message.messageTypes.CONNECTIONRESPONSE] = connection.response;
handlers[lib.message.messageTypes.CONNECTIONACKNOWLEDGE] = connection.acknowledgement;
handlers[lib.message.messageTypes.CREDENTIALOFFER] = credential.offer;
handlers[lib.message.messageTypes.CREDENTIALREQUEST] = credential.request;
handlers[lib.message.messageTypes.CREDENTIAL] = credential.credential;
handlers[lib.message.messageTypes.PROOFREQUEST] = proof.request;
handlers[lib.message.messageTypes.PROOF] = proof.proof;

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
            decryptedMessage = await lib.crypto.anonDecrypt(w.handle, w.ownDid, encryptedMessage);
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
    // TODO register crd (the u is omitted) in routes/index.js
    list: wrap(async (req, res, next) => {
        // TODO list messages of wallet
        // also allow for query params to filter by type
        return next(new APIResult(501, { message: 'not implemented' }));
    }),

    retrieve: wrap(async (req, res, next) => {
        // TODO
        return next(new APIResult(501, { message: 'not implemented' }));
    }),

    delete: wrap(async (req, res, next) => {
        // TODO
        return next(new APIResult(501, { message: 'not implemented' }));
    }),

    sendMessage: wrap(async (req, res, next) => {
        const wallet = req.wallet;
        const did = req.body.did;
        const message = req.body.message;
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
                const result = await handler(wallet, message);
                return next(result);
            }
            next(new APIResult(400, { message: 'unknown message type ' + message.type }));
        } finally {
            await WalletProvider.returnHandle(wallet);
        }
    })
};
