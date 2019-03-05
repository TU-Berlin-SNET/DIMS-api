const sdk = require('indy-sdk');
const ledger = require('./ledger');

const SignatureTypes = { CL: 'CL' };

module.exports = {
    SignatureTypes,

    /**
     * Create and send a credential definition to the ledger
     * @param {number} walletHandle
     * @param {string} submitterDid
     * @param {string} schemaId
     * @param {string} [tag] to distinguish between credential definitions from same issuer and schema
     * @param {boolean} [supportRevocation] default: false
     * @param {string} [signatureType] default: 'CL'
     * @return {Promise<Any[]>} [credDefId, credDef] - credential definition is
     * retrieved from ledger so it includes seqNo (which is subsequently needed by indy-sdk)
     */
    async create(
        walletHandle,
        submitterDid,
        schemaId,
        tag,
        supportRevocation = false,
        signatureType = SignatureTypes.CL
    ) {
        // retrieve schema and create credential definition
        const [, schema] = await ledger.getSchema(submitterDid, schemaId);
        const [credDefId, data] = await sdk.issuerCreateAndStoreCredentialDef(
            walletHandle,
            submitterDid,
            schema,
            tag,
            signatureType,
            { support_revocation: supportRevocation }
        );
        // push credential definition on ledger and retrieve it again
        await ledger.credDefRequest(walletHandle, submitterDid, data);
        const [, credDef] = await ledger.getCredDef(submitterDid, credDefId);
        return [credDefId, credDef];
    }
};
