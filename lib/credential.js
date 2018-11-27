const sdk = require('indy-sdk');

const message = require('./indy-message');
const revocationRegistry = require('./revocation-registry');
const fs = require('fs');
const pool = require('../pool');

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
            let result = '';
            for (let i = 0; i < value.length; i++) {
                result += value.charCodeAt(i).toString(16);
            }
            return result;
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
    async createCredentialOffer(walletHandle, credDefId, recipientDid) {
        const pairwise = await sdk.getPairwise(walletHandle, recipientDid);
        const innerMessage = await sdk.issuerCreateCredentialOffer(walletHandle, credDefId);
        return {
            id: innerMessage.nonce,
            origin: pairwise['my_did'],
            type: message.messageTypes.CREDENTIALOFFER,
            message: innerMessage
        };
    },

    async createCredentialRequest(walletHandle, senderDid, credentialOffer, credentialDefinition, masterSecretId) {
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

    async issuerCreateCredential(walletHandle, senderDid, credentialRequest, credentialValues, revocReg) {
        if (revocReg) {
            const blobStorageReaderHandle = await revocationRegistry.openBlobStorageReader({
                base_dir: revocationRegistry.tailsBaseDir,
                uri_pattern: ''
            });

            const [credential, credRevocId, revocRegDelta] = await sdk.issuerCreateCredential(
                walletHandle,
                credentialRequest.meta.offer,
                credentialRequest.message.message,
                credentialValues,
                revocReg.revocRegId,
                blobStorageReaderHandle
            );

            // store new value of the accumulator
            await pool.revocRegEntryRequest(
                walletHandle,
                senderDid,
                revocReg.revocRegId,
                revocationRegistry.revocationType,
                revocRegDelta
            );
            return [credential, credRevocId, revocRegDelta];
        } else {
            const [credential, credRevocId, revocRegDelta] = await sdk.issuerCreateCredential(
                walletHandle,
                credentialRequest.meta.offer,
                credentialRequest.message.message,
                credentialValues,
                null,
                null
            );
            return [credential, credRevocId, revocRegDelta];
        }
    },

    async issuerRevokeCredential(walletHandle, senderDid, credRevocId, revocReg) {
        if (revocReg && credRevocId) {
            const blobStorageReaderHandle = await revocationRegistry.openBlobStorageReader({
                base_dir: revocationRegistry.tailsBaseDir,
                uri_pattern: ''
            });

            const revocRegDelta = await sdk.issuerRevokeCredential(
                walletHandle,
                blobStorageReaderHandle,
                revocReg.revocRegId,
                credRevocId
            );

            // store new value of the accumulator
            await pool.revocRegEntryRequest(
                walletHandle,
                senderDid,
                revocReg.revocRegId,
                revocationRegistry.revocationType,
                revocRegDelta
            );
            return revocRegDelta;
        } else {
            throw Error('cant revoke credential');
        }
    }
};
