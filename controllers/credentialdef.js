/**
 * IDChain Agent REST API
 * Credential Definition Controller
 */
'use strict';

const fs = require('fs');
const path = require('path');
const uuidv4 = require('uuid/v4');

const config = require('../config');
const log = require('../log').log;
const lib = require('../lib');
const wrap = require('../asyncwrap').wrap;
const APIResult = require('../api-result');
const CredDef = require('../models/credentialdef');
const RevocRegistry = require('../models/revocation-registry');

module.exports = {
    create: wrap(async (req, res, next) => {
        const schemaId = req.body.schemaId;
        const tag = req.body.tag === undefined ? uuidv4() : req.body.tag;

        const [credDefId, credDef] = await lib.credentialdefinition.create(
            req.wallet.handle,
            req.wallet.ownDid,
            schemaId,
            tag,
            req.body.supportRevocation
        );

        let credDefDoc = await new CredDef({
            credDefId: credDefId,
            wallet: req.wallet,
            data: credDef
        }).save();

        if (req.body.supportRevocation) {
            const [revocRegDefId, revocRegDef] = await lib.revocation.createDef(
                req.wallet.handle,
                req.wallet.ownDid,
                credDefId,
                uuidv4(),
                { maxCredNum: 100 },
                revDef => (revDef.value.tailsLocation = config.APP_TAILS_ENDPOINT + revDef.value.tailsHash)
            );

            await new RevocRegistry({
                revocRegDefId,
                credDefId,
                revocationType: revocRegDef.revocDefType,
                hash: revocRegDef.value.tailsHash
            }).save();

            credDefDoc.revocRegDefId = revocRegDefId;
            credDefDoc.revocRegType = revocRegDef.revocDefType;
            await credDefDoc.save();
        }

        next(new APIResult(201, { credDefId: credDefDoc.credDefId }));
    }),

    list: wrap(async (req, res, next) => {
        const w = await CredDef.find({ wallet: req.wallet.id }).exec();
        next(new APIResult(200, w));
    }),

    retrieve: wrap(async (req, res, next) => {
        const [, credDef] = await lib.ledger.getCredDef(req.wallet.ownDid, req.params.credDefId);
        next(APIResult.success(credDef));
    }),

    retrieveTails: wrap(async (req, res, next) => {
        const data = await new Promise((resolve, reject) => {
            fs.readFile(path.join(lib.blobStorage.config.base_dir, req.params.tailsHash), 'base64', (err, data) => {
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
