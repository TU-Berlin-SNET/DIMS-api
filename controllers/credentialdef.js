/**
 * IDChain Agent REST API
 * Credential Definition Controller
 */

const indy = require('indy-sdk');

const CredDef = require('../models/credentialdef');
const wrap = require('../asyncwrap').wrap;
const pool = require('../pool');
const APIResult = require('../api-result');

module.exports = {
    create: wrap(async (req, res, next) => {
        const submitterDid = req.wallet.ownDid;
        const schemaId = req.body.schemaId;
        const supportRevocation = req.body.supportRevocation || false;
        const [, schema] = await pool.getSchema(submitterDid, schemaId);
        const [credDefId, credDef] = await indy.issuerCreateAndStoreCredentialDef(
            req.wallet.handle,
            req.wallet.ownDid,
            schema,
            'TAG1',
            'CL',
            { support_revocation: supportRevocation }
        );
        const response = await pool.credDefRequest(req.wallet.handle, req.wallet.ownDid, credDef);

        let doc = {
            credDefId: credDefId,
            wallet: req.wallet.id,
            data: response['result']
        };
        if (supportRevocation) {
            const blobStorageWriter = await pool.openBlobStorageWriter();
            // supported config keys depend on credential type
            // currently, indy only supports CL_ACCUM as credential type
            const revocRegConfig = {
                issuance_type: 'ISSUANCE_ON_DEMAND',
                max_cred_num: 1000
            };
            const [revocRegId, revocRegDef, revocRegEntry] = await indy.issuerCreateAndStoreRevocReg(
                req.wallet.handle,
                req.wallet.ownDid,
                null,
                'TAG1',
                credDefId,
                revocRegConfig,
                blobStorageWriter
            );
            await pool.revocRegDefRequest(req.wallet.handle, req.wallet.ownDid, revocRegDef);
            await pool.revocRegEntryRequest(
                req.wallet.handle,
                req.wallet.ownDid,
                revocRegId,
                revocRegDef.revocDefType,
                revocRegEntry
            );
            doc.revocRegId = revocRegId;
            doc.revocRegType = revocRegDef.revocDefType;
        }

        const credDefDoc = await new CredDef(doc).save();
        next(new APIResult(201, { credDefId: credDefDoc.credDefId }));
    }),

    list: wrap(async (req, res, next) => {
        const w = await CredDef.find({ wallet: req.wallet.id }).exec();
        next(new APIResult(200, w));
    }),

    retrieve: wrap(async (req, res, next) => {
        const credDefId = req.params.credDefId;
        const submitterDid = req.wallet.ownDid;
        const [, credDef] = await pool.getCredDef(submitterDid, credDefId);
        next(new APIResult(200, credDef));
    })
};
