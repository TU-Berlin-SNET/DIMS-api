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
    }
};
const templates = {
    proofRequest: `{
        "name": "Ticket-{{name}}",
        "version": "0.1",
        "requested_attributes": {
            "attr1_referent": {
                "name": "firstname",
                "restrictions": [{ "cred_def_id": "{{credDefId}}" }]
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
let relyingparty;
let issuerHolderPairwise;
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
        relyingparty = await core.prepareUser(data.relyingparty);
        [steward, issuer, holder, relyingparty].forEach(v =>
            valuesToDelete.push({ id: v.id, token: v.token, path: 'user' })
        );

        // onboard issuer as TRUST_ANCHOR
        // and holder and relying-party as NONE
        // (to use ownDid as endpoint did for communication)
        await Promise.all([
            core.onboard(
                steward.token,
                issuer.wallet.ownDid,
                issuer.wallet.dids.find(v => v.did === issuer.wallet.ownDid).verkey,
                'TRUST_ANCHOR'
            ),
            core.onboard(
                steward.token,
                holder.wallet.ownDid,
                holder.wallet.dids.find(v => v.did === holder.wallet.ownDid).verkey,
                'NONE'
            ),
            core.onboard(
                steward.token,
                relyingparty.wallet.ownDid,
                relyingparty.wallet.dids.find(v => v.did === relyingparty.wallet.ownDid).verkey,
                'NONE'
            )
        ]);

        [issuerHolderPairwise, relyingpartyHolderPairwise] = await Promise.all([
            // establish pairwise connection issuer <-> holder
            core.connect(
                issuer.token,
                holder.token
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
                    proofAge: 18,
                    to: Math.floor(Date.now() / 1000)
                })
            )
        };
        const res = await core.postRequest('/api/proofrequest', relyingparty.token, postBody, 201);
        expect(res.body).to.contain.keys('id', 'type', 'messageId', 'message', 'meta');
        expect(res.body.meta).to.have.property('proofId');
        expect(res.body.message.message).to.contain.keys(
            'name',
            'version',
            'nonce',
            'requested_attributes',
            'requested_predicates'
        );
        proofId = res.body.meta.proofId;
    });

    it('should retrieve proof using proofId and the status should be pending', async function() {
        const res = await core.getRequest('/api/proof/' + proofId, relyingparty.token, 200);
        expect(res.body).to.contain.keys('id', 'wallet', 'did', 'proof', 'status', 'isValid');
        expect(res.body.did).to.equal(relyingpartyHolderPairwise['their_did']);
        expect(res.body.proof).to.be.null;
        expect(res.body.status).to.equal('pending');
        expect(res.body.isValid).to.be.false;
    });

    it('should list received proof requests', async function() {
        const res = await core.getRequest('/api/proofrequest', holder.token, 200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(1);
        expect(res.body[0])
            .to.have.property('message')
            .that.is.an('Object');
        expect(res.body[0].message).to.contain.keys('id', 'type', 'origin', 'message');
        expect(res.body[0].message.message).to.contain.keys(
            'name',
            'version',
            'requested_attributes',
            'requested_predicates'
        );
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
        expect(res.body.message).to.contain.keys('id', 'type', 'origin', 'message');
        expect(res.body.message.message).to.contain.keys('requested_proof', 'proof', 'identifiers');
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
        expect(proof.isValid).to.be.true;
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
