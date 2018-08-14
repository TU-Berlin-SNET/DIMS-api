const indy = require('indy-sdk');

module.exports = {
    async anonCrypt(verkey, message) {
        const messageRaw = Buffer.from(JSON.stringify(message), 'utf-8');
        const messageBuf = await indy.cryptoAnonCrypt(verkey, messageRaw);
        return messageBuf.toString('base64');
    },

    async anonDecrypt(handle, did, encryptedMessage) {
        const encryptedBuffer = Buffer.from(JSON.stringify(encryptedMessage), 'utf-8');
        const verkey = await indy.keyForLocalDid(handle, did);
        const decryptedBuffer = await indy.cryptoAnonDecrypt(handle, verkey, encryptedBuffer);
        const decryptedString = Buffer.from(decryptedBuffer).toString('utf-8');
        return JSON.parse(decryptedString);
    },

    async authCrypt(handle, did, message) {
        // TODO
    },

    async authDecrypt(handle, message) {
        // TODO
    }
};
