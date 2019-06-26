const sdk = require('indy-sdk');
const ledger = require('./ledger');
const message = require('./indy-message');
const blobStorage = require('./blob-storage');

module.exports = {
    /**
     * Encode a value as required by indy, i.e.
     * toString numbers and process strings.
     * @param {any} value value to encode
     * @return {string} encoded value
     */
    encode(value) {
        const valueType = typeof value;
        if (valueType === 'number' || !isNaN(Number(value))) {
            return value.toString();
        }
        if (valueType === 'string') {
            return Buffer.from(value).join('');
        }
        if (valueType === 'boolean') {
            return value ? '1' : '0';
        }

        const err = {
            error: {
                name: 'LibError',
                status: 500,
                message: 'encode failure, unsupported value type ' + valueType
            }
        };
        throw err;
    },

    /**
     * Create a credential offer and return it
     * @param {number} walletHandle
     * @param {string} credDefId
     * @param {string} recipientDid
     * @return {Promise<Object>} credential offer - not encrypted
     */
    async buildOffer(walletHandle, credDefId, recipientDid) {
        const pairwise = await sdk.getPairwise(walletHandle, recipientDid);
        const innerMessage = await sdk.issuerCreateCredentialOffer(walletHandle, credDefId);
        return {
            id: innerMessage.nonce,
            origin: pairwise['my_did'],
            type: message.messageTypes.CREDENTIALOFFER,
            message: innerMessage
        };
    },

    /**
     * Create a credential request
     * @param {number} walletHandle
     * @param {string} senderDid
     * @param {object} credentialOffer
     * @param {object} credentialDefinition
     * @param {string} masterSecretId
     * @return {Promise<Array>} [request, meta]
     */
    async buildRequest(walletHandle, senderDid, credentialOffer, credentialDefinition, masterSecretId) {
        const [innerMessage, meta] = await sdk.proverCreateCredentialReq(
            walletHandle,
            senderDid,
            credentialOffer,
            credentialDefinition,
            masterSecretId
        );
        const request = {
            id: credentialOffer.nonce,
            origin: senderDid,
            type: message.messageTypes.CREDENTIALREQUEST,
            message: innerMessage
        };
        return [request, meta];
    },

    /**
     * Create/issue a credential with provided credential values
     * @param {number} walletHandle
     * @param {string} senderDid
     * @param {object} credentialRequest
     * @param {object} credentialValues
     * @param {object} revocReg
     * @return {Promise<Array>} [credential, credRevocId, revocRegDelta]
     */
    async issue(walletHandle, senderDid, credentialRequest, credentialValues, revocReg) {
        const [credential, credRevocId, revocRegDelta] = await sdk.issuerCreateCredential(
            walletHandle,
            credentialRequest.meta.offer,
            credentialRequest.meta.request,
            credentialValues,
            revocReg ? revocReg.revocRegDefId : null,
            blobStorage.reader
        );

        if (revocReg) {
            // store new value of the accumulator
            await ledger.revocRegEntryRequest(
                walletHandle,
                senderDid,
                revocReg.revocRegDefId,
                revocReg.revocationType,
                revocRegDelta
            );
        }

        return [credential, credRevocId, revocRegDelta];
    },

    /**
     * Revoke an issued credential
     * @param {number} walletHandle
     * @param {string} senderDid
     * @param {string} credRevocId
     * @param {object} revocReg
     * @return {Promise<object>} revocRegDelta
     */
    async revoke(walletHandle, senderDid, credRevocId, revocReg) {
        if (revocReg && credRevocId) {
            const revocRegDelta = await sdk.issuerRevokeCredential(
                walletHandle,
                blobStorage.reader,
                revocReg.revocRegDefId,
                credRevocId
            );

            // store new value of the accumulator
            await ledger.revocRegEntryRequest(
                walletHandle,
                senderDid,
                revocReg.revocRegDefId,
                revocReg.revocationType,
                revocRegDelta
            );
            return revocRegDelta;
        } else {
            throw Error('cant revoke credential');
        }
    }
};
