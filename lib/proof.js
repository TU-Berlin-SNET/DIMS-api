const fs = require('fs');
const sdk = require('indy-sdk');
const agent = require('superagent');
const crypto = require('./crypto');
const pairwise = require('./pairwise');
const message = require('./indy-message');
const tails = require('./revocation-registry');

/**
 * Retrieve and build requestedFields object for requested field object in proof request
 * to use in creation of proof
 * @param {number} walletHandle
 * @param {string} submitterDid
 * @param {Ledger} ledger
 * @param {number} searchHandle
 * @param {object} requestFields requested field object in proof request, e.g. requested_attributes, ...
 * @param {object} [values] values for self-attested-attributes
 * @return {Promise<Any[]>} [selfAttestededAttributes, requestedFields]
 */
async function buildRequestedFields(walletHandle, submitterDid, ledger, searchHandle, requestFields, values) {
    const schemas = {};
    const credentialDefinitions = {};
    const selfAttestedAttributes = {};
    const requestedFields = {};
    const revocationStates = {};

    // loop through referents of requestFields (which is requested_attributes or requested_predicates) object
    for (const referent of Object.keys(requestFields)) {
        const attribute = requestFields[referent];
        const result = await sdk.proverFetchCredentialsForProofReq(searchHandle, referent, 1);

        if (result.length > 0) {
            // we found one, just use first one for now
            const credential = result[0]['cred_info'];
            requestedFields[referent] = {
                cred_id: credential.referent
            };
            // retrieve additional information (as needed for proof creation)
            schemas[credential.schema_id] = (await ledger.getSchema(submitterDid, credential.schema_id))[1];
            credentialDefinitions[credential.cred_def_id] = (await ledger.getCredDef(
                submitterDid,
                credential.cred_def_id
            ))[1];

            // if applicable: retrieve revocation information
            // and build revocation state
            if (credential.rev_reg_id) {
                const now = Math.floor(Date.now() / 1000);
                const [, revRegDef] = await ledger.getRevocRegDef(submitterDid, credential.rev_reg_id);
                const [, revRegDelta, timestamp] = await ledger.getRevocRegDelta(
                    submitterDid,
                    credential.rev_reg_id,
                    0,
                    now
                );

                // tails is immutable so check if we already have it
                // and if not, retrieve it
                const filePath = tails.tailsBaseDir + '/' + revRegDef.value.tailsHash;
                const fileExists = await new Promise(resolve => {
                    fs.stat(filePath, (err, stats) => {
                        resolve(!!err);
                    });
                });
                if (!fileExists) {
                    const res = await agent.get(revRegDef.value.tailsLocation);
                    await new Promise((resolve, reject) => {
                        fs.writeFile(filePath, res.body, 'base64', err => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    });
                }

                const tailsReaderHandle = await tails.openBlobStorageReader({
                    base_dir: tails.tailsBaseDir,
                    uri_pattern: ''
                });
                const revState = await sdk.createRevocationState(
                    tailsReaderHandle,
                    revRegDef,
                    revRegDelta,
                    timestamp,
                    credential.cred_rev_id
                );
                if (!revocationStates[credential.rev_reg_id]) {
                    revocationStates[credential.rev_reg_id] = {};
                }
                requestedFields[referent].timestamp = timestamp;
                revocationStates[credential.rev_reg_id][timestamp] = revState;
            }
        } else if ((!attribute.restrictions || attribute.restrictions.length === 0) && values[attribute.name]) {
            // there was none but we have a value and also no restrictions so add it to self-attested
            selfAttestedAttributes[referent] = values[attribute.name];
        } else {
            // no credential and no value and/or restrictions => throw error
            const err = {
                error: {
                    name: 'LibError',
                    status: 400,
                    message: `failed to build proof request: invalid or missing value for requested field with referent ${referent} and name ${
                        attribute.name
                    } in proof request`
                }
            };
            throw err;
        }
    }

    return [selfAttestedAttributes, requestedFields, schemas, credentialDefinitions, revocationStates];
}

module.exports = {
    /**
     * Create a proof request message
     * @param {number} walletHandle
     * @param {string} recipientDid
     * @param {object} proofRequest proof request object containing requested_attributes, requested_predicates, .. but not nonce etc.
     * @return {Promise<object>} proof request message object
     */
    async createProofRequest(walletHandle, recipientDid, proofRequest) {
        const pairwiseInfo = await pairwise.getPairwise(walletHandle, recipientDid);
        proofRequest.nonce = await crypto.getNonce();
        return {
            id: proofRequest.nonce,
            type: message.messageTypes.PROOFREQUEST,
            origin: pairwiseInfo['my_did'],
            message: proofRequest
        };
    },

    /**
     * Create a proof message
     * @param {number} walletHandle
     * @param {Ledger} ledger
     * @param {string} masterSecretId
     * @param {string} recipientDid
     * @param {object} proofRequest
     * @param {object} [values]
     * @return {Promise<object>} proof message object
     */
    async createProof(walletHandle, ledger, masterSecretId, recipientDid, proofRequest, values = {}) {
        const pairwiseInfo = await pairwise.getPairwise(walletHandle, recipientDid);
        const searchHandle = await sdk.proverSearchCredentialsForProofReq(walletHandle, proofRequest, null);
        const [
            selfAttestedAttributes,
            requestedAttributes,
            attributeSchemas,
            attributeCredentialDefinitions,
            attributeRevocationStates
        ] = await buildRequestedFields(
            walletHandle,
            pairwiseInfo['my_did'],
            ledger,
            searchHandle,
            proofRequest.requested_attributes,
            values
        );
        const [
            selfAttestedPredicates,
            requestedPredicates,
            predicateSchemas,
            predicateCredentialDefinitions,
            predicateRevocationStates
        ] = await buildRequestedFields(
            walletHandle,
            pairwiseInfo['my_did'],
            ledger,
            searchHandle,
            proofRequest.requested_predicates,
            values
        );
        await sdk.proverCloseCredentialsSearchForProofReq(searchHandle);
        Object.keys(requestedAttributes).map(k => (requestedAttributes[k].revealed = true));
        const requestedCredentials = {
            self_attested_attributes: Object.assign({}, selfAttestedAttributes, selfAttestedPredicates),
            requested_attributes: requestedAttributes,
            requested_predicates: requestedPredicates
        };
        const schemas = Object.assign({}, attributeSchemas, predicateSchemas);
        const credentialDefinitions = Object.assign({}, attributeCredentialDefinitions, predicateCredentialDefinitions);
        const revStates = Object.assign({}, attributeRevocationStates, predicateRevocationStates);

        const proof = await sdk.proverCreateProof(
            walletHandle,
            proofRequest,
            requestedCredentials,
            masterSecretId,
            schemas,
            credentialDefinitions,
            revStates
        );

        return {
            id: proofRequest.nonce,
            type: message.messageTypes.PROOF,
            origin: pairwiseInfo['my_did'],
            message: proof
        };
    }
};
