const pool = require('../pool');
const lib = require('../lib');
const indy = require('indy-sdk');
const config = require('../config');
const log = require('../log').log;
const agent = require('superagent');

const Schema = require('../models/schema');
const CredDef = require('../models/credentialdef');
const RevocRegistry = require('../models/revocation-registry');

const wrap = require('../asyncwrap').wrap;
const APIResult = require('../api-result');

const schemaCompilerUrl = `http://${process.env.IDC_SCHEMA_IP}:${process.env.IDC_SCHEMA_PORT}`;

/**
 * CollectParentSchemas
 *
 * @param {string} walletId - Wallet Id
 * @param {string} parentId - parentId
 * @return {Promise<array>} parentSchemas - All related parent Schemas
 *
 */
async function collectParentSchemas(walletId, parentId) {
    let parentSchemas = [];
    while (parentId) {
        const schema = await Schema.findOne({
            wallet: walletId,
            _id: parentId
        }).exec();
        if (!schema) throw APIResult.notFound('parent schema not found');
        parentId = schema.parentSchemaId;
        parentSchemas.push(schema);
    }
    return parentSchemas;
}

module.exports = {
    types: wrap(async (req, res, next) => {
        const response = await agent.get(`${schemaCompilerUrl}/types`);
        next(APIResult.success(response.body));
    }),

    async list(wallet, query) {
        let filter = { wallet: wallet.id };
        if (query.onlyActive) filter.isDeprecated = false;
        return Schema.find(filter).exec();
    },

    async create(wallet, user, name, version, parentSchemaId, attributes, createCredentialDefinition, isRevocable) {
        const exists = await Schema.findOne({
            wallet: wallet.id,
            name: name,
            version: version
        }).exec();

        if (exists) throw new APIResult(409); // schema with same name and version already exists in db for the current user

        // Collect all related parent schemas
        let allSchemas = await collectParentSchemas(wallet.id, parentSchemaId);

        // Lowercase attribute names and replace spaces with underscore
        attributes = attributes.map(a => {
            a.name = a.name.toLowerCase().replace(/[ ]/g, '_');
            return a;
        });

        // Append the new schema to typecheck
        allSchemas.push({
            name: name,
            version: version,
            parentSchemaId: parentSchemaId,
            attributes: attributes,
            isRevocable: isRevocable
        });

        allSchemas = allSchemas.map(s => {
            if (s.parentSchemaId) {
                const [, , parentSchemaName, parentSchemaVersion] = s.parentSchemaId.split(':');
                s.parentSchemaName = parentSchemaName;
                s.parentSchemaVersion = parentSchemaVersion;
            }
            delete s.parentSchemaId;
            return s;
        });

        let response;
        // Send request to schema-compiler API
        response = await agent
            .post(`${schemaCompilerUrl}/schema`)
            .type('application/json')
            .send(allSchemas)
            .catch(err => {
                throw new APIResult(err.status, JSON.parse(err.response.text));
            }); // forward the errors and messages

        // Select submitted Schema
        const generatedSchema = response.body.find(s => s.name === name && s.version === version);

        // publish schema on the ledger
        const [schemaId, schema] = await lib.schema.create(
            wallet.handle,
            pool,
            wallet.ownDid,
            generatedSchema.name,
            generatedSchema.version,
            generatedSchema.attr_names
        );

        let schemaDoc = {
            _id: schemaId,
            name: name,
            version: version,
            attributes: attributes,
            wallet: wallet.id,
            owner: user,
            isRevocable: isRevocable,
            lowLevelSchema: schema
        };

        if (parentSchemaId) {
            schemaDoc.parentSchemaId = parentSchemaId;
        }

        if (createCredentialDefinition) {
            // publish creddef on the ledger
            const [credDefId, credDef] = await lib.credentialdefinition.create(
                wallet.handle,
                pool,
                wallet.ownDid,
                schemaId,
                'TAG1',
                isRevocable
            );

            let doc = {
                credDefId: credDefId,
                wallet: wallet.id,
                data: credDef
            };

            let tailsdoc = {};

            if (isRevocable) {
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
                    wallet.handle,
                    wallet.ownDid,
                    null,
                    'TAG1',
                    credDefId,
                    revocRegConfig,
                    blobStorageWriter
                );

                // set full URL in tailsLocation
                revocRegDef.value.tailsLocation = config.APP_TAILS_ENDPOINT + revocRegDef.value.tailsHash;

                await pool.revocRegDefRequest(wallet.handle, wallet.ownDid, revocRegDef);
                // store first value of the accumulator
                await pool.revocRegEntryRequest(
                    wallet.handle,
                    wallet.ownDid,
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
            await new CredDef(doc).save();
            if (isRevocable) {
                await new RevocRegistry(tailsdoc).save();
            }
            schemaDoc.credentialDefinitionId = credDefId;
        }
        return new Schema(schemaDoc).save();
    },

    async retrieve(wallet, id) {
        // NOTE: we don't contact the ledger but the mongodb only
        return Schema.findById(id).exec(); // correctly throws 404 when not found
    },

    async update(wallet, id, operation) {
        if (operation === 'revoke') {
            let doc = await Schema.findOne({ _id: id, wallet: wallet.id }).exec();
            if (doc && doc.isRevocable && !doc.isDeprecated) {
                // TODO: revoke it

                doc.isDeprecated = true;
                await doc.save();
                return;
            }
            throw new APIResult(422); // else, it cannot be patched
        }
    }
};
