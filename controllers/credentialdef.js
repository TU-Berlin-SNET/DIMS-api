/**
 * IDChain Agent REST API
 * Credential Definition Controller
 */

const indy = require('indy-sdk');

const lib = require('../lib');
const wrap = require('../asyncwrap').wrap;
const pool = require('../pool');
const APIResult = require('../api-result');
const CredDef = require('../models/credentialdef');

module.exports = {
    create: wrap(async (req, res, next) => {
        const schemaId = req.body.schemaId;
        const supportRevocation = req.body.supportRevocation || false;
        const [credDefId, credDef] = await lib.credentialdefinition.create(
            req.wallet.handle,
            pool,
            req.wallet.ownDid,
            schemaId,
            'TAG1',
            'CL',
            supportRevocation
        );
        let doc = {
            credDefId: credDefId,
            wallet: req.wallet.id,
            data: credDef
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
        const [, credDef] = await pool.getCredDef(req.wallet.ownDid, req.params.credDefId);
        next(APIResult.success(credDef));
    })
};
