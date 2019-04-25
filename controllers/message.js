/**
 * IDChain Agent REST API
 * Message Controller
 */

const log = require('../log').log;
const lib = require('../lib');
const APIResult = require('../util/api-result');
const Wallet = require('../models/wallet');

const WalletProvider = require('../middleware/walletProvider');
const connection = require('./connection/index');
const credential = require('./credential/index');
const proof = require('./proof/index');

module.exports = exports = {};

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

exports.receiveMessage = async encryptedMessage => {
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
};
