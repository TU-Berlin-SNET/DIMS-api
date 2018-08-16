const indy = require('indy-sdk');

module.exports = {
    async anonCrypt(verkey, message) {
        const messageRaw = Buffer.from(message, 'utf-8');
        const messageBuf = await indy.cryptoAnonCrypt(verkey, messageRaw);
        return messageBuf.toString('base64');
    },

    async anonDecrypt(handle, did, encryptedMessage) {
        const encryptedBuffer = Buffer.from(encryptedMessage, 'base64');
        const verkey = await indy.keyForLocalDid(handle, did);
        const decryptedBuffer = await indy.cryptoAnonDecrypt(handle, verkey, encryptedBuffer);
        const decryptedString = Buffer.from(decryptedBuffer).toString('utf-8');
        const decryptedMessage = JSON.parse(decryptedString);
        return decryptedMessage;
    },

    async authCrypt(handle, did, message) {
        // TODO
    },

    async authDecrypt(handle, message) {
        // TODO
    }
};
