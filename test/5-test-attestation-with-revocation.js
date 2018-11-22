/**
 * IDChain Agent REST API
 * API Tests
 * Tests Attestation with revocation
 * (Schemas, Credential Definitions, Credentials, and Proofs)
 */
'use strict';

const uuidv4 = require('uuid/v4');
const mocha = require('mocha');
const expect = require('chai').expect;

const vars = require('./0-test-vars');
const core = require('./0-test-core');

const { describe, before, after, it } = mocha;

const agent = vars.agent;
const bothHeaders = vars.bothHeaders;
const testId = uuidv4();
const valuesToDelete = [];

const users = {
    steward: {
        username: 'teststeward' + testId,
        password: 'steward',
        wallet: {
            name: 'teststewardWallet' + testId,
            seed: '000000000000000000000000Steward1',
            credentials: { key: 'teststewardkey' }
        }
    },
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
    relyingParty: {
        username: 'testrelyingpary' + testId,
        password: 'relyingpary',
        wallet: { name: 'testrelyingparywallet' + testId, credentials: { key: 'testrelyingparyKey' } }
    }
};

const schema = {
    name: 'Passport-' + uuidv4(),
    version: '0.1',
    attrNames: ['firstname', 'lastname', 'age']
};

// testcase-global variables
let issuer;
let holder;
let rp;
let credDefId;
let holderIssuerDid;
let holderRPDid;

describe('attestation with revocation (schemas, credentials, and proofs)', function() {
    before(async function() {
        // create users and wallets
        await Promise.all(
            Object.entries(users).map(async ([key, value]) => {
                value.id = await core.createUser(value);
                value.token = await core.login(value.username, value.password);
                valuesToDelete.push({ id: value.id, token: value.token, path: 'user' });
                const res = await agent
                    .get('/api/wallet/default')
                    .set(bothHeaders)
                    .set({ Authorization: value.token })
                    .expect(200);
                value.wallet = res.body;
            })
        );

        // onboard issuer and relying party as TRUST_ANCHOR
        await Promise.all([
            core.onboard(
                users.steward.token,
                users.issuer.wallet.ownDid,
                users.issuer.wallet.dids.filter(v => v.did === users.issuer.wallet.ownDid)[0].verkey,
                'TRUST_ANCHOR'
            ),
            core.onboard(
                users.steward.token,
                users.relyingParty.wallet.ownDid,
                users.relyingParty.wallet.dids.filter(v => v.did === users.relyingParty.wallet.ownDid)[0].verkey,
                'TRUST_ANCHOR'
            )
        ]);

        // establish pairwise connections issuer <-> holder, and relyingparty <-> holder
        const [issuerHolderPairwise, rpHolderPairwise] = await Promise.all([
            core.connect(
                users.issuer.token,
                users.holder.token
            ),
            core.connect(
                users.relyingParty.token,
                users.holder.token
            )
        ]);
        holderIssuerDid = issuerHolderPairwise['their_did'];
        holderRPDid = rpHolderPairwise['their_did'];

        issuer = users.issuer;
        holder = users.holder;
        rp = users.relyingParty;
    });

    after(async function() {
        await core.clean(valuesToDelete);
    });

    describe('schemas', function() {
        it('issuer should create a indy-schema', async function() {
            const res = await agent
                .post('/api/indyschema')
                .set(bothHeaders)
                .set({ Authorization: issuer.token })
                .send(schema)
                .expect(201);
            expect(res.body).to.have.property('schemaId');
            schema.id = res.body.schemaId;
        });
    });

    describe('credential definitions', function() {
        it('issuer should create a credential definition which does support revocation', async function() {
            const res = await agent
                .post('/api/credentialdef')
                .set(bothHeaders)
                .set({ Authorization: issuer.token })
                .send({
                    schemaId: schema.id,
                    supportRevocation: true
                })
                .expect(201);
            expect(res.body).to.have.property('credDefId');
            credDefId = res.body.credDefId;
        });
    });

    describe('credentials', function() {
        // testcase-local variables
        let credentialOffer;
        let credentialRequest;
        let revCredentialId;

        it('issuer should send credential offer and holder should receive it', async function() {
            const res = await agent
                .post('/api/credentialoffer')
                .set(bothHeaders)
                .set({ Authorization: issuer.token })
                .send({
                    wallet: issuer.wallet.id,
                    recipientDid: holderIssuerDid,
                    credDefId: credDefId
                })
                .expect(201);
            expect(res.body).to.contain.keys('id', 'type', 'message', 'messageId');
            expect(res.body.message.message).to.contain.keys(
                'schema_id',
                'cred_def_id',
                'nonce',
                'key_correctness_proof'
            );
            expect(res.body.messageId).to.equal(res.body.message.message.nonce);

            const res2 = await agent
                .get('/api/credentialoffer')
                .set(bothHeaders)
                .set({ Authorization: holder.token })
                .expect(200);
            expect(res2.body)
                .to.be.an('Array')
                .with.lengthOf(1);
            expect(res2.body[0]).to.contain.keys('id', 'type', 'message', 'messageId');
            expect(res2.body[0].message.message).to.eql(res.body.message.message);
            credentialOffer = res2.body[0];
        });

        it('holder should accept credential offer and send credential request, and issuer should receive it', async function() {
            const res = await agent
                .post('/api/credentialrequest')
                .set(bothHeaders)
                .set({ Authorization: holder.token })
                .send({
                    credentialOfferId: credentialOffer.id
                })
                .expect(201);
            expect(res.body).to.contain.keys('id', 'type', 'message', 'messageId');
            expect(res.body.message.message).to.contain.keys(
                'prover_did',
                'cred_def_id',
                'blinded_ms',
                'blinded_ms_correctness_proof',
                'nonce'
            );

            const res2 = await agent
                .get('/api/credentialrequest')
                .set(bothHeaders)
                .set({ Authorization: issuer.token })
                .expect(200);
            expect(res2.body)
                .to.be.an('Array')
                .with.lengthOf(1);
            expect(res2.body[0]).to.contain.keys('id', 'type', 'message', 'messageId');
            expect(res2.body[0].message.message).to.eql(res.body.message.message);
            credentialRequest = res2.body[0];
        });

        it('issuer should accept credential request, issue/send credential, and holder should receive it', async function() {
            const res = await agent
                .post('/api/credential')
                .set(bothHeaders)
                .set({ Authorization: issuer.token })
                .send({
                    credentialRequestId: credentialRequest.id,
                    values: {
                        firstname: 'Alice',
                        lastname: 'Doe',
                        age: '32'
                    }
                })
                .expect(201);
            expect(res.body).to.contain.keys('id', 'type', 'message', 'messageId');
            expect(res.body.message.message).to.contain.keys('schema_id', 'cred_def_id', 'values');
            revCredentialId = res.body.id;

            const res2 = await agent
                .get('/api/credential')
                .set(bothHeaders)
                .set({ Authorization: holder.token })
                .expect(200);
            expect(res2.body)
                .to.be.an('Array')
                .with.lengthOf(1);
            expect(res2.body[0]).to.contain.keys('referent', 'attrs');
            expect(res2.body[0].attrs)
                .to.have.property('firstname')
                .that.equals('Alice');
            expect(res2.body[0].attrs)
                .to.have.property('lastname')
                .that.equals('Doe');
            expect(res2.body[0].attrs)
                .to.have.property('age')
                .that.equals('32');
        });

        it('issuer should revoke issued credential', async function() {
            await agent
                .post(`/api/credential/${revCredentialId}/revoke`)
                .set(bothHeaders)
                .set({ Authorization: issuer.token })
                .expect(200);
        });
    });

    describe('proofs', function() {
        // testcase-local variables
        let template;
        let proofRequest;
        let proof;

        it('relying party should create proof request template', async function() {
            const payload = `{
                "name": "Ticket",
                "version": "0.1",
                "requested_attributes": {
                    "attr1_referent": {
                        "name": "firstname",
                        "restrictions": [{ "cred_def_id": "${credDefId}" }]
                    },
                    "attr2_referent": {
                        "name": "lastname",
                        "restrictions": [{ "cred_def_id": "${credDefId}" }]
                    },
                    "attr3_referent": {
                        "name": "phone"
                    }
                },
                "requested_predicates": {
                    "predicate1_referent": {
                        "name": "age",
                        "p_type": ">=",
                        "p_value": {{ age }},
                        "restrictions": [{ "cred_def_id": "${credDefId}" }]
                    }
                }
            }`;
            const res = await agent
                .post('/api/proofrequesttemplate')
                .set(bothHeaders)
                .set({ Authorization: rp.token })
                .send({ template: payload })
                .expect(201);
            expect(res.body).to.contain.keys('id', 'wallet', 'template');
            expect(res.body.template).to.eql(payload);
            template = res.body;
        });

        it('relying party should list proof request template', async function() {
            const res = await agent
                .get('/api/proofrequesttemplate')
                .set(bothHeaders)
                .set({ Authorization: rp.token })
                .expect(200);
            expect(res.body)
                .to.be.an('Array')
                .with.lengthOf(1);
            expect(res.body[0]).to.eql(template);
        });

        it('relying party should retrieve proof request template', async function() {
            const res = await agent
                .get('/api/proofrequesttemplate/' + template.id)
                .set(bothHeaders)
                .set({ Authorization: rp.token })
                .expect(200);
            expect(res.body).to.eql(template);
        });

        it('relying party should create/send proof request using template and holder should receive it', async function() {
            const res = await agent
                .post('/api/proofrequest')
                .set(bothHeaders)
                .set({ Authorization: rp.token })
                .send({
                    recipientDid: holderRPDid,
                    proofRequest: template.id,
                    templateValues: {
                        age: 18
                    }
                })
                .expect(201);
            expect(res.body).to.contain.keys('id', 'type', 'messageId', 'message', 'meta');
            expect(res.body.meta).to.have.property('proofId');
            expect(res.body.message.message).to.contain.keys(
                'name',
                'version',
                'nonce',
                'requested_attributes',
                'requested_predicates'
            );
            proof = { id: res.body.meta.proofId };

            const res2 = await agent
                .get('/api/proofrequest')
                .set(bothHeaders)
                .set({ Authorization: holder.token })
                .expect(200);
            expect(res2.body)
                .to.be.an('Array')
                .with.lengthOf(1);
            // check that nonces match
            expect(res2.body[0]).to.have.property('messageId', res.body.messageId);
            proofRequest = res2.body[0];
            expect(proofRequest)
                .to.have.property('message')
                .that.is.an('Object');
            expect(proofRequest.message).to.contain.keys('id', 'type', 'origin', 'message');
            expect(proofRequest.message.message).to.contain.keys(
                'name',
                'version',
                'requested_attributes',
                'requested_predicates'
            );
        });

        it('relying party should delete proof request template', async function() {
            await agent
                .delete('/api/proofrequesttemplate/' + template.id)
                .set(bothHeaders)
                .set({ Authorization: rp.token })
                .expect(204);
        });

        it('relying party should query proof status using proofId and it should be pending', async function() {
            const res = await agent
                .get('/api/proof/' + proof.id)
                .set(bothHeaders)
                .set({ Authorization: rp.token })
                .expect(200);
            expect(res.body).to.contain.keys('id', 'wallet', 'did', 'proof', 'status', 'isValid');
            expect(res.body.did).to.equal(holderRPDid);
            expect(res.body.proof).to.be.null;
            expect(res.body.status).to.equal('pending');
            expect(res.body.isValid).to.be.false;
        });

        it('holder should accept proof request and create/send proof', async function() {
            const res = await agent
                .post('/api/proof')
                .set(bothHeaders)
                .set({ Authorization: holder.token })
                .send({
                    proofRequestId: proofRequest.id,
                    values: {
                        phone: '11110000'
                    }
                })
                .expect(201);
            expect(res.body).to.contain.keys('id', 'type', 'messageId', 'message');
            expect(res.body.message).to.contain.keys('id', 'type', 'origin', 'message');
            expect(res.body.message.message).to.contain.keys('requested_proof', 'proof', 'identifiers');
        });

        it('relying party should query proof status and it should be received and the proof should be invalid', async function() {
            const res = await agent
                .get('/api/proof/' + proof.id)
                .set(bothHeaders)
                .set({ Authorization: rp.token })
                .expect(200);
            expect(res.body).to.contain.keys('id', 'wallet', 'did', 'proof', 'status', 'isValid');
            expect(res.body.did).to.equal(holderRPDid);
            expect(res.body.proof).to.not.be.null;
            expect(res.body.status).to.equal('received');
            expect(res.body.isValid).to.be.false;
        });
    });
});
