const sdk = require('indy-sdk');
const crypto = require('crypto');

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
        const [, decryptedBuffer] = await sdk.cryptoAuthDecrypt(handle, recipientVk, encryptedBuffer);
        return decryptedBuffer.toString('utf-8');
    },

    /**
     * Auth decrypt message and JSON.parse
     * @param {number} handle
     * @param {string} recipientVk
     * @param {string} encryptedMessage
     * @return {Promise<Object>} auth decrypted message
     */
    async authDecryptJSON(handle, recipientVk, encryptedMessage) {
        return JSON.parse(await module.exports.authDecrypt(handle, recipientVk, encryptedMessage));
    },

    /**
     * Wrap ~sig field
     * @param {Wallet} wallet
     * @param {Object} data
     * @param {string} verkey
     * @return {Promise<Object>} sigField
     */
    async wrapSigField(wallet, data, verkey) {
        const timestamp = Math.floor(Date.now() / 1000);
        const sigDataBuf = Buffer.from(timestamp + JSON.stringify(data), 'utf-8');
        const signatureBuf = await sdk.cryptoSign(wallet.handle, verkey, sigDataBuf);
        const sigField = {
            '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/signature/1.0/ed25519Sha512_single',
            signature: signatureBuf.toString('base64'),
            sig_data: sigDataBuf.toString('base64'),
            signer: verkey
        };
        return sigField;
    },

    /**
     * Unwrap ~sig field
     * @param {Object} data the ~sig field
     * @return {Promise<Object>} unwrapped data in sig_data field
     */
    async unwrapSigField(data) {
        const sigDataBuf = Buffer.from(data.sig_data, 'base64');
        const sigData = sigDataBuf.toString('utf-8');
        const splitIndex = sigData.indexOf('{');
        // const timestamp = Number(sigData.substring(0, splitIndex));
        return JSON.parse(sigData.substring(splitIndex));
    },

    /**
     * Verify Signature field
     * @param {Object} data the ~sig field
     * @return {Promise<Boolean>} true if signature is valid, false otherwise
     */
    async sigFieldIsValid(data) {
        const sigDataBuf = Buffer.from(data.sig_data, 'base64');
        const signatureBuf = Buffer.from(data.signature, 'base64');
        return await sdk.cryptoVerify(data.signer, sigDataBuf, signatureBuf);
    }
};
