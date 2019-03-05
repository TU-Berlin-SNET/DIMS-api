const sdk = require('indy-sdk');
const ledger = require('./ledger');
const blobStorage = require('./blob-storage');

// the default max_cred_num is set to 100 to prevent
// this code from taking too long to generate tails
// note that tails occupy
// 256 * max_cred_num bytes + 130 bytes of the header
const DEFAULT_MAX_CRED_NUM = 100;

// currently, indy only supports CL_ACCUM as revocation type
const RevocationTypes = { CL_ACCUM: 'CL_ACCUM' };

const IssuanceTypes = {
    // accumulator is calculated using all indices as all
    // are assumed to be issued, revocation registry updates only
    // necessary on revocation
    BY_DEFAULT: 'ISSUANCE_BY_DEFAULT',
    // accumulator is 1 initially as nothing is assumed to be issued
    ON_DEMAND: 'ISSUANCE_ON_DEMAND'
};

module.exports = {
    RevocationTypes,
    IssuanceTypes,

    /**
     * Create and send a revocation registry definition and entry to the ledger
     * @param {number} walletHandle
     * @param {string} submitterDid
     * @param {string} credDefId
     * @param {string} tag to distinguish between revocation registries from same issuer and credential definition
     * @param {object} options {
     *  revocationType: string<optional> (default CL_ACCUM),
     *  issuanceType: string<optional> (default ISSUANCE_ON_DEMAND),
     *  maxCredNum: number<optional> (default DEFAULT_MAX_CRED_NUM),
     * }
     * @param {function} [transform] transform revocRegDef before writing on the ledger (e.g. for tailsLocation manipulation)
     * @return {Promise<Array>} [revocRegDefId, revocRegDef, revocRegEntry]
     */
    async createDef(walletHandle, submitterDid, credDefId, tag, options = {}, transform) {
        const revocationType = options.revocationType || RevocationTypes.CL_ACCUM;
        const issuanceType = options.IssuanceTypes || IssuanceTypes.ON_DEMAND;
        const maxCredNum = options.maxCredNum || DEFAULT_MAX_CRED_NUM;

        const [revocRegDefId, revocRegDef, revocRegEntry] = await sdk.issuerCreateAndStoreRevocReg(
            walletHandle,
            submitterDid,
            revocationType,
            tag,
            credDefId,
            { issuance_type: issuanceType, max_cred_num: maxCredNum },
            blobStorage.writer
        );

        if (transform) {
            transform(revocRegDef);
        }

        // write public part of revocation registry definition
        // and entry onto ledger (if CL_ACCUM is used then this is the first value of the accumulator)
        await ledger.revocRegDefRequest(walletHandle, submitterDid, revocRegDef);
        await ledger.revocRegEntryRequest(walletHandle, submitterDid, revocRegDefId, revocationType, revocRegEntry);

        return [revocRegDefId, revocRegDef, revocRegEntry];
    }
};
