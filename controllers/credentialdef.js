/**
 * IDChain Agent REST API
 * Credential Definition Controller
 */
'use strict';

const fs = require('fs');
const path = require('path');
const uuidv4 = require('uuid/v4');

const config = require('../config');
const log = require('../log');
const lib = require('../lib');
const CredDef = require('../models/credentialdef');
const RevocRegistry = require('../models/revocation-registry');

module.exports = {
    async create(wallet, options) {
        const schemaId = options.schemaId;
        const tag = options.tag === undefined ? uuidv4() : options.tag;

        const [credDefId, credDef] = await lib.credentialdefinition.create(
            wallet.handle,
            wallet.ownDid,
            schemaId,
            tag,
            options.supportRevocation
        );

        let credDefDoc = await new CredDef({
            credDefId: credDefId,
            wallet: wallet,
            data: credDef
        }).save();

        if (options.supportRevocation) {
            const [revocRegDefId, revocRegDef] = await lib.revocation.createDef(
                wallet.handle,
                wallet.ownDid,
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

        return { credDefId: credDefDoc.credDefId };
    },

    async list(wallet) {
        return CredDef.find({ wallet: wallet.id }).exec();
    },

    async retrieve(wallet, id) {
        const [, credDef] = await lib.ledger.getCredDef(wallet.ownDid, id);
        return credDef;
    },

    async retrieveTails(hash) {
        return new Promise((resolve, reject) => {
            fs.readFile(path.join(lib.blobStorage.config.base_dir, hash), 'base64', (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }
};
