/**
 * IDChain Agent REST API
 * Credential Definition Controller
 */
'use strict';

const fs = require('fs');
const indy = require('indy-sdk');

const config = require('../config');
const lib = require('../lib');
const wrap = require('../asyncwrap').wrap;
const pool = require('../pool');
const APIResult = require('../api-result');
const CredDef = require('../models/credentialdef');
const RevocRegistry = require('../models/revocation-registry');

module.exports = {
    create: wrap(async (req, res, next) => {
        const schemaId = req.body.schemaId;
        const supportRevocation = req.body.supportRevocation || false;
        const tag = req.body.tag || 'TAG1';
        const [credDefId, credDef] = await lib.credentialdefinition.create(
            req.wallet.handle,
            pool,
            req.wallet.ownDid,
            schemaId,
            tag,
            supportRevocation
        );

        let doc = {
            credDefId: credDefId,
            wallet: req.wallet.id,
            data: credDef
        };

        let tailsdoc = {};

        if (supportRevocation) {
            const blobStorageConfig = { base_dir: lib.revocationRegistry.tailsBaseDir, uri_pattern: '' };
            // TODO: investigate the purpose of uri_pattern

            const blobStorageWriter = await lib.revocationRegistry.openBlobStorageWriter(blobStorageConfig);
            // supported config keys depend on credential type
            // currently, indy only supports CL_ACCUM as credential type
            // the max_cred_num is set to 100 to prevent this code from taking too long to generate tails
            // note that tails occupy  256 * max_cred_num bytes + 130 bytes of the header
            const revocRegConfig = {
                issuance_type: 'ISSUANCE_ON_DEMAND',
                max_cred_num: 100
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

            // set full URL in tailsLocation
            revocRegDef.value.tailsLocation = config.APP_TAILS_ENDPOINT + revocRegDef.value.tailsHash;

            await pool.revocRegDefRequest(req.wallet.handle, req.wallet.ownDid, revocRegDef);
            // store first value of the accumulator
            await pool.revocRegEntryRequest(
                req.wallet.handle,
                req.wallet.ownDid,
                revocRegId,
                lib.revocationRegistry.revocationType,
                revocRegEntry
            );
            doc.revocRegId = revocRegId;
            doc.revocRegType = revocRegDef.revocDefType;

            tailsdoc.revocRegId = revocRegId;
            tailsdoc.hash = revocRegDef.value.tailsHash;
            // foreign key
            tailsdoc.credDefId = credDefId;
        }

        const credDefDoc = await new CredDef(doc).save();
        if (supportRevocation) {
            await new RevocRegistry(tailsdoc).save();
        }
        next(new APIResult(201, { credDefId: credDefDoc.credDefId }));
    }),

    list: wrap(async (req, res, next) => {
        const w = await CredDef.find({ wallet: req.wallet.id }).exec();
        next(new APIResult(200, w));
    }),

    retrieve: wrap(async (req, res, next) => {
        const [, credDef] = await pool.getCredDef(req.wallet.ownDid, req.params.credDefId);
        next(APIResult.success(credDef));
    }),

    retrieveTails: wrap(async (req, res, next) => {
        const data = await new Promise((resolve, reject) => {
            fs.readFile(lib.revocationRegistry.tailsBaseDir + '/' + req.params.tailsHash, 'base64', (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
        next(new APIResult(200, data));
    })
};
