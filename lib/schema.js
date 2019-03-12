const sdk = require('indy-sdk');
const ledger = require('./ledger');

module.exports = {
    /**
     * Create and send a schema to the ledger
     * @param {number} walletHandle
     * @param {string} issuerDid
     * @param {string} name schema name
     * @param {string} version schema version
     * @param {string[]} attributeNames array of attribute names to put into schema
     * @return {Promise<Any[]>} [schemaId, schema] - schema is retrieved
     * from ledger so it includes seqNo (which is subsequently needed by indy-sdk)
     */
    async create(walletHandle, issuerDid, name, version, attributeNames) {
        // create and push schema to ledger
        const [schemaId, data] = await sdk.issuerCreateSchema(issuerDid, name, version, attributeNames);
        await ledger.schemaRequest(walletHandle, issuerDid, data);

        // retrieve back from ledger to have seqNo etc. which is needed for any
        // subsequent operations in indy-sdk
        const [, schema] = await ledger.getSchema(issuerDid, schemaId);
        return [schemaId, schema];
    }
};
