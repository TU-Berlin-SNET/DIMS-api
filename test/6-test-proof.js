/**
 * IDChain Agent REST API
 * API Tests
 * Tests Proofs
 */
'use strict';

const Mustache = require('mustache');
const mocha = require('mocha');
const expect = require('chai').expect;
const uuidv4 = require('uuid/v4');
const core = require('./0-test-core');

const { before, after, describe, it } = mocha;
const testId = uuidv4();

const valuesToDelete = [];
const data = {
    issuer: {
        username: 'testissuer' + testId,
        password: 'issuer',
        wallet: { name: 'testissuerWallet' + testId, credentials: { key: 'testissuerKey' } }
    },
    holder: {
        username: 'testholder' + testId,
        password: 'holder',
        wallet: { name: 'testholderWallet' + testId, credentials: { key: 'testholderKey' } }
    },
    relyingparty: {
        username: 'testrelyingparty' + testId,
        password: 'relyingparty',
        wallet: { name: 'testrelyingpartyWallet' + testId, credentials: { key: 'testrelyingpartyKey' } }
    },
    holder2: {
        username: 'testholder2' + testId,
        password: 'holder2',
        wallet: { name: 'testholder2Wallet' + testId, credentials: { key: 'testholder2Key' } }
    },
    schema: {
        name: 'Passport-' + uuidv4(),
        version: '0.1',
        attrNames: ['firstname', 'lastname', 'age']
    },
    credPositive: {
        firstname: 'Alice',
        lastname: 'Doe',
        age: '32'
    },
    credNegative: {
        firstname: 'Alice',
        lastname: 'Doe',
        age: '-32'
    },
    credHolder2: {
        firstname: 'Bob',
        lastname: 'Doe',
        age: '32'
    }
};
const templates = {
    proofRequest: `{
        "name": "Ticket-{{name}}",
        "version": "0.1",
        "requested_attributes": {
            "attr1_referent": {
                "name": "firstname",
                "restrictions": [{
                    "cred_def_id": "{{credDefId}}",
                    "issuer_did": "{{issuerDid}}",
                    "schema_id": "{{schemaId}}"
                }]
            },
            "attr2_referent": {
                "name": "lastname",
                "restrictions": [{ "cred_def_id": "{{credDefId}}" }]
            },
            "attr3_referent": {
                "name": "phone"
            }
        },
        "requested_predicates": {
            "predicate1_referent": {
                "name": "age",
                "p_type": ">=",
                "p_value": {{proofAge}},
                "restrictions": [{ "cred_def_id": "{{credDefId}}" }]
            }
        },
        "non_revoked": {"to": {{ to }}}
    }`
};

let issuer;
let holder;
let holder2;
let relyingparty;
let issuerHolderPairwise;
let issuerHolder2Pairwise;
let relyingpartyHolderPairwise;
let schema;
let credDefPositive;
let credDefNegative;
let credDefRevoc;
let credRevocId;
let proofRequest;
let proofId;

describe('proofs', function() {
    before(async function() {
        const steward = await core.steward(testId);
        issuer = await core.prepareUser(data.issuer);
        holder = await core.prepareUser(data.holder);
        holder2 = await core.prepareUser(data.holder2);
        relyingparty = await core.prepareUser(data.relyingparty);
        [steward, issuer, holder, relyingparty].forEach(v =>
            valuesToDelete.push({ id: v.id, token: v.token, path: 'user' })
        );

        // onboard issuer as TRUST_ANCHOR
        await Promise.all([
            core.onboard(
                steward.token,
                issuer.wallet.ownDid,
                issuer.wallet.dids.find(v => v.did === issuer.wallet.ownDid).verkey,
                'TRUST_ANCHOR'
            )
        ]);

        [issuerHolderPairwise, issuerHolder2Pairwise, relyingpartyHolderPairwise] = await Promise.all([
            // establish pairwise connection issuer <-> holder
            core.connect(
                issuer.token,
                holder.token
            ),
            core.connect(
                issuer.token,
                holder2.token
            ),
            // establish pairwise connection relyingparty <-> holder
            core.connect(
                relyingparty.token,
                holder.token
            )
        ]);

        // create schema and credDef
        schema = await core.createSchema(issuer.token, data.schema);
        [credDefPositive, credDefNegative, credDefRevoc] = await Promise.all([
            core.createCredDef(issuer.token, {
                tag: 'Passport-Positive-' + testId,
                schemaId: schema.schemaId,
                supportRevocation: false
            }),
            core.createCredDef(issuer.token, {
                tag: 'Passport-Negative-' + testId,
                schemaId: schema.schemaId,
                supportRevocation: false
            }),
            core.createCredDef(issuer.token, {
                tag: 'Passport-Revoc-' + testId,
                schemaId: schema.schemaId,
                supportRevocation: true
            })
        ]);

        // issue credentials
        const [, , credentialMessage] = await Promise.all([
            core.issueCredential(
                issuer.token,
                holder.token,
                issuerHolderPairwise['their_did'],
                credDefPositive.credDefId,
                data.credPositive
            ),
            core.issueCredential(
                issuer.token,
                holder.token,
                issuerHolderPairwise['their_did'],
                credDefNegative.credDefId,
                data.credNegative
            ),
            core.issueCredential(
                issuer.token,
                holder.token,
                issuerHolderPairwise['their_did'],
                credDefRevoc.credDefId,
                data.credPositive
            )
        ]);

        credRevocId = credentialMessage.id;
    });

    after(async function() {
        await core.clean(valuesToDelete);
    });

    it('should create/send proof request', async function() {
        const postBody = {
            recipientDid: relyingpartyHolderPairwise['their_did'],
            proofRequest: JSON.parse(
                Mustache.render(templates.proofRequest, {
                    name: 'Ticket-Positive-' + testId,
                    credDefId: credDefPositive.credDefId,
                    issuerDid: issuer.wallet.ownDid,
                    schemaId: schema.schemaId,
                    proofAge: 18,
                    to: Math.floor(Date.now() / 1000)
                })
            )
        };
        const res = await core.postRequest('/api/proofrequest', relyingparty.token, postBody, 201);
        expect(res.body).to.contain.keys('id', 'type', 'messageId', 'message', 'meta');
        expect(res.body.meta).to.have.property('proofId');
        expect(res.body.message).to.contain.keys('@id', '@type', 'comment', 'request_presentations~attach');
        expect(res.body.message['request_presentations~attach'])
            .to.be.an('Array')
            .with.lengthOf(1);
        expect(res.body.message['request_presentations~attach'][0]).to.contain.keys('@id', 'mime-type', 'data');
        proofId = res.body.meta.proofId;
    });

    it('should retrieve proof using proofId and the status should be pending', async function() {
        const res = await core.getRequest('/api/proof/' + proofId, relyingparty.token, 200);
        expect(res.body).to.contain.keys('id', 'wallet', 'did', 'proof', 'status');
        expect(res.body.did).to.equal(relyingpartyHolderPairwise['their_did']);
        expect(res.body.proof).to.be.null;
        expect(res.body.status).to.equal('pending');
    });

    it('should list received proof requests', async function() {
        const res = await core.getRequest('/api/proofrequest', holder.token, 200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(1);
        expect(res.body[0])
            .to.have.property('message')
            .that.is.an('Object');
        proofRequest = res.body[0];
    });

    it('should accept proof request and create/send proof', async function() {
        const postBody = {
            proofRequestId: proofRequest.id,
            values: {
                phone: '11110000'
            }
        };
        const res = await core.postRequest('/api/proof', holder.token, postBody, 201);
        expect(res.body).to.contain.keys('id', 'type', 'messageId', 'message');
        expect(res.body.message).to.contain.keys('@id', '@type', 'comment', 'presentations~attach');
        expect(res.body.message['presentations~attach'])
            .to.be.an('Array')
            .with.lengthOf(1);
        expect(res.body.message['presentations~attach'][0]).to.contain.keys('@id', 'mime-type', 'data');
    });

    it('should list received proofs', async function() {
        const res = await core.getRequest('/api/proof', relyingparty.token, 200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(1);
        expect(res.body[0]).to.contain.keys('id', 'wallet', 'did', 'proof', 'status');
    });

    it('should retrieve proof using proofId and it should be received and the proof should be valid', async function() {
        const res = await core.getRequest('/api/proof/' + proofId, relyingparty.token, 200);
        expect(res.body).to.contain.keys('id', 'wallet', 'did', 'proof', 'status', 'isValid');
        expect(res.body.did).to.equal(relyingpartyHolderPairwise['their_did']);
        expect(res.body.proof).to.not.be.null;
        expect(res.body.status).to.equal('received');
        expect(res.body.isValid).to.be.true;
    });

    it('should retrieve another proof and ZKP verification should work with negative values (i.e. -32 >= -40), too', async function() {
        const proof = await core.getProof(
            relyingparty.token,
            holder.token,
            relyingpartyHolderPairwise['their_did'],
            JSON.parse(
                Mustache.render(templates.proofRequest, {
                    name: 'Ticket-Negative-' + testId,
                    credDefId: credDefNegative.credDefId,
                    issuerDid: issuer.wallet.ownDid,
                    schemaId: schema.schemaId,
                    proofAge: -40,
                    to: Math.floor(Date.now() / 1000)
                })
            ),
            null,
            { phone: '11110000' }
        );
        expect(proof).to.contain.keys('id', 'wallet', 'did', 'proof', 'status', 'isValid');
        expect(proof.did).to.equal(relyingpartyHolderPairwise['their_did']);
        expect(proof.proof).to.not.be.null;
        expect(proof.status).to.equal('received');
        expect(proof.isValid).to.be.true;
    });

    it('should retrieve another proof and ZKP verification should work with mixed values (i.e. 32 >= -40), too', async function() {
        const proof = await core.getProof(
            relyingparty.token,
            holder.token,
            relyingpartyHolderPairwise['their_did'],
            JSON.parse(
                Mustache.render(templates.proofRequest, {
                    name: 'Ticket-Mixed-' + testId,
                    credDefId: credDefPositive.credDefId,
                    issuerDid: issuer.wallet.ownDid,
                    schemaId: schema.schemaId,
                    proofAge: -40,
                    to: Math.floor(Date.now() / 1000)
                })
            ),
            null,
            { phone: '11110000' }
        );
        expect(proof).to.contain.keys('id', 'wallet', 'did', 'proof', 'status', 'isValid');
        expect(proof.did).to.equal(relyingpartyHolderPairwise['their_did']);
        expect(proof.proof).to.not.be.null;
        expect(proof.status).to.equal('received');
        expect(proof.isValid).to.be.true;
    });

    it('should retrieve proof containing revokable credentials and it should be valid', async function() {
        const proof = await core.getProof(
            relyingparty.token,
            holder.token,
            relyingpartyHolderPairwise['their_did'],
            JSON.parse(
                Mustache.render(templates.proofRequest, {
                    name: 'Ticket-Revoc-' + testId,
                    credDefId: credDefRevoc.credDefId,
                    issuerDid: issuer.wallet.ownDid,
                    schemaId: schema.schemaId,
                    proofAge: 18,
                    to: Math.floor(Date.now() / 1000)
                })
            ),
            null,
            { phone: '11110000' }
        );
        proofId = proof.id;
        expect(proof).to.contain.keys('id', 'wallet', 'did', 'proof', 'status', 'isValid');
        expect(proof.did).to.equal(relyingpartyHolderPairwise['their_did']);
        expect(proof.proof).to.not.be.null;
        expect(proof.status).to.equal('received');
        expect(proof.isValid).to.be.true;
    });

    it('should issue another credential and proof should still be valid', async function() {
        await core.issueCredential(
            issuer.token,
            holder2.token,
            issuerHolder2Pairwise['their_did'],
            credDefRevoc.credDefId,
            data.credHolder2
        );
        const res = await core.getRequest('/api/proof/' + proofId, relyingparty.token, 200);
        expect(res.body).to.contain.keys('id', 'wallet', 'did', 'proof', 'status', 'isValid');
        expect(res.body.did).to.equal(relyingpartyHolderPairwise['their_did']);
        expect(res.body.proof).to.not.be.null;
        expect(res.body.status).to.equal('received');
        expect(res.body.isValid).to.be.true;
    });

    it('should revoke issued credential', async function() {
        const res = await core.postRequest(`/api/credential/${credRevocId}/revoke`, issuer.token, {}, 200);
        expect(res.body).to.contain.keys('ver', 'value');
        expect(res.body.value.revoked).to.not.be.null;
    });

    it('should retrieve proof containing revokable credentials and it should now be invalid', async function() {
        const proof = await core.getProof(
            relyingparty.token,
            holder.token,
            relyingpartyHolderPairwise['their_did'],
            JSON.parse(
                Mustache.render(templates.proofRequest, {
                    name: 'Ticket-Revoc-' + testId,
                    credDefId: credDefRevoc.credDefId,
                    issuerDid: issuer.wallet.ownDid,
                    schemaId: schema.schemaId,
                    proofAge: 18,
                    to: Math.floor(Date.now() / 1000)
                })
            ),
            null,
            { phone: '11110000' }
        );
        expect(proof).to.contain.keys('id', 'wallet', 'did', 'proof', 'status', 'isValid');
        expect(proof.did).to.equal(relyingpartyHolderPairwise['their_did']);
        expect(proof.proof).to.not.be.null;
        expect(proof.status).to.equal('received');
        expect(proof.isValid).to.be.false;
    });
});
