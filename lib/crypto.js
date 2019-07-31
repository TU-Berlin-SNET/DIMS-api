const sdk = require('indy-sdk');
const crypto = require('crypto');
const uuidv4 = require('uuid/v4');

module.exports = {
    /**
     * Generate and return a cryptographically secure random nonce
     * @return {string} nonce
     */
    async getNonce() {
        // node v8.x only supports Uint8Arrays as input to randomFill
        const arr = new Uint8Array(8);
        return new Promise((resolve, reject) => {
            crypto.randomFill(arr, (err, buf) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(buf.join(''));
                }
            });
        });
    },

    /**
     * Generate and return an id
     * @return {Promise<string>}
     */
    async generateId() {
        return uuidv4();
    },

    /**
     * Creates cryptographic key pair
     * @param {Wallet} wallet
     * @param {object} [options]
     */
    async createKey(wallet, options = {}) {
        return await sdk.createKey(wallet.handle, options);
    },

    /**
     * Anoncrypt message for verkey
     * @param {string} verkey
     * @param {(string | object)} message objects are JSON.stringified before encryption
     * @return {Promise<string>} anoncrypted, base-64 encoded message string
     */
    async anonCrypt(verkey, message) {
        let content = message;
        if (typeof message === 'object') {
            content = JSON.stringify(message);
        }
        const messageRaw = Buffer.from(content, 'utf-8');
        const messageBuf = await sdk.cryptoAnonCrypt(verkey, messageRaw);
        return messageBuf.toString('base64');
    },

    /**
     * Anon decrypt encrypted message to a string
     * @param {number} handle
     * @param {string} verkey
     * @param {string} encryptedMessage
     * @return {Promise<string>} decrypted string message
     */
    async anonDecrypt(handle, verkey, encryptedMessage) {
        const encryptedBuffer = Buffer.from(encryptedMessage, 'base64');
        const decryptedBuffer = await sdk.cryptoAnonDecrypt(handle, verkey, encryptedBuffer);
        return decryptedBuffer.toString('utf-8');
    },

    /**
     * Anon decrypt and JSON.parse encrypted message
     * @param {number} handle
     * @param {string} verkey
     * @param {string} encryptedMessage
     * @return {Promise<Object>} decrypted message
     */
    async anonDecryptJSON(handle, verkey, encryptedMessage) {
        return JSON.parse(await module.exports.anonDecrypt(handle, verkey, encryptedMessage));
    },

    /**
     * Auth crypt message string
     * @param {number} handle
     * @param {string} senderVk
     * @param {string} recipientVk
     * @param {(string | object)} message objects are JSON.stringified before encryption
     * @return {Promise<string>} authcrypted, base-64 encoded message string
     */
    async authCrypt(handle, senderVk, recipientVk, message) {
        let content = message;
        if (typeof message === 'object') {
            content = JSON.stringify(message);
        }
        const messageRaw = Buffer.from(content, 'utf-8');
        const messageBuf = await sdk.cryptoAuthCrypt(handle, senderVk, recipientVk, messageRaw);
        return messageBuf.toString('base64');
    },

    /**
     * Auth decrypt message
     * @param {number} handle
     * @param {string} recipientVk
     * @param {string} encryptedMessage
     * @return {Promise<string>} auth decrypted message string
     */
    async authDecrypt(handle, recipientVk, encryptedMessage) {
        const encryptedBuffer = Buffer.from(encryptedMessage, 'base64');
        const [senderVk, decryptedBuffer] = await sdk.cryptoAuthDecrypt(handle, recipientVk, encryptedBuffer);
        return [senderVk, decryptedBuffer.toString('utf-8')];
    },

    /**
     * Auth decrypt message and JSON.parse
     * @param {number} handle
     * @param {string} recipientVk
     * @param {string} encryptedMessage
     * @return {Promise<Object>} auth decrypted message
     */
    async authDecryptJSON(handle, recipientVk, encryptedMessage) {
        const [senderVk, decryptedMessage] = await module.exports.authDecrypt(handle, recipientVk, encryptedMessage);
        return [senderVk, JSON.parse(decryptedMessage)];
    },

    /**
     * Pack message
     * @param {*} wallet
     * @param {(string | object)} message
     * @param {*} receiverKeys
     * @param {*} senderVk
     * @return {object} packed jwe object
     */
    async packMessage(wallet, message, receiverKeys, senderVk) {
        let data = message;
        if (typeof data === 'object') {
            data = JSON.stringify(message);
        }
        const messageRaw = Buffer.from(data, 'utf-8');
        const messagePacked = await sdk.packMessage(wallet.handle, messageRaw, receiverKeys, senderVk);
        return JSON.parse(messagePacked.toString('utf-8'));
    },

    /**
     * Unpack message
     * @param {*} wallet
     * @param {(string | Buffer | object | array)} message
     * @param {string} [encoding] (default = base64 for strings, utf-8 for objects/arrays) encoding of message
     * @return {Promise<object>}
     */
    async unpackMessage(wallet, message, encoding) {
        let data = message;
        if (typeof data === 'string') {
            data = Buffer.from(message, encoding || 'base64');
        }
        if (!Buffer.isBuffer(data) && (typeof data === 'object' || Array.isArray(data))) {
            data = Buffer.from(JSON.stringify(message), 'utf-8');
        }
        let messageUnpacked = await sdk.unpackMessage(wallet.handle, data);
        messageUnpacked = JSON.parse(messageUnpacked.toString('utf-8'));
        messageUnpacked.message = JSON.parse(messageUnpacked.message);
        return messageUnpacked;
    },

    /**
     * @param {(string | number | object | array)} data
     * @return {string} base64 encoded string
     */
    b64encode(data) {
        let input = data;
        if (typeof input === 'object' || Array.isArray(input)) {
            input = JSON.stringify(input);
        }
        return Buffer.from(input, 'utf-8').toString('base64');
    },

    /**
     * @param {(string | buffer)} data base64 encoded string or buffer
     * @return {string} utf-8 string
     */
    b64decode(data) {
        let input = data;
        if (!Buffer.isBuffer(input)) {
            input = Buffer.from(input, 'base64');
        }
        return input.toString('utf-8');
    }
};
