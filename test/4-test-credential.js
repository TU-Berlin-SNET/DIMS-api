/**
 * IDChain Agent REST API
 * API Tests
 * Tests Credentials and Proofs
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

let issuer;
let holder;
let rp;
let credDefId;
let holderIssuerDid;
let holderRPDid;

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

describe('credentials and proofs', function() {
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

    describe('credentials', function() {
        let schemaId;
        let credentialOffer;
        let credentialRequest;
        let credential;
        let credentialId;

        it('issuer should create a schema', async function() {
            const res = await agent
                .post('/api/schema')
                .set(bothHeaders)
                .set({ Authorization: issuer.token })
                .send({
                    name: 'Passport-' + uuidv4(),
                    version: '0.1',
                    attrNames: ['firstname', 'lastname', 'yearOfBirth']
                })
                .expect(201);
            expect(res.body).to.have.property('schemaId');
            schemaId = res.body.schemaId;
        });

        it('issuer should create a credential definition', async function() {
            const res = await agent
                .post('/api/credentialdef')
                .set(bothHeaders)
                .set({ Authorization: issuer.token })
                .send({
                    schemaId: schemaId,
                    // FIXME add another test WITH revocation as soon as revocation is supported by proofs
                    supportRevocation: false
                })
                .expect(201);
            expect(res.body).to.have.property('credDefId');
            credDefId = res.body.credDefId;
        });

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
                        yearOfBirth: '1999'
                    }
                })
                .expect(201);
            expect(res.body).to.contain.keys('id', 'type', 'message', 'messageId');
            expect(res.body.message.message).to.contain.keys('schema_id', 'cred_def_id', 'values');

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
                .to.have.property('yearOfBirth')
                .that.equals('1999');
        });
    });

    // FIXME put this back in once proofs are done
    // with new message formats and agent-to-agent comm
    // maybe even split into its own test file
    describe.skip('proofs', function() {
        let proofRequest;
        let proof;
        it('relying party should create proof request', async function() {
            bothHeaders.Authorization = rp.token;
            const res = await agent
                .post('/api/proofrequest')
                .auth(rp.username, rp.password)
                .set(bothHeaders)
                .send({
                    wallet: rp.wallet.id,
                    recipientDid: holderRPDid,
                    proofRequest: {
                        name: 'Ticket',
                        version: '0.1',
                        requested_attributes: {
                            attr1_referent: {
                                name: 'firstname',
                                restrictions: [{ cred_def_id: `${credDefId}` }]
                            },
                            attr2_referent: {
                                name: 'lastname',
                                restrictions: [{ cred_def_id: `${credDefId}` }]
                            },
                            attr3_referent: {
                                name: 'phone'
                            }
                        },
                        requested_predicates: {
                            // FIXME predicates do not work at the moment, add me back in or add another test
                            //  'predicate1_referent': {
                            //    'name': 'yearOfBirth',
                            //    'p_type': '<',
                            //    'p_value': 2000,
                            //    'restrictions': [{'cred_def_id': credDefId}],
                            //  },
                        }
                    }
                })
                .expect(201);
            expect(res.body).to.have.property('encryptedProofRequest');
            proofRequest = res.body.encryptedProofRequest;
        });
        it('holder should accept proof request and create proof', async function() {
            bothHeaders.Authorization = holder.token;
            const res = await agent
                .post('/api/proof')
                .set(bothHeaders)
                .send({
                    wallet: holder.wallet.id,
                    encryptedProofRequest: proofRequest,
                    selfAttestedAttributes: {
                        phone: '11110000'
                    }
                })
                .expect(201);
            expect(res.body).to.have.property('encryptedProof');
            proof = res.body.encryptedProof;
        });
        it('relying party should create proof verification', async function() {
            bothHeaders.Authorization = rp.token;
            const res = await agent
                .post('/api/proofverification')
                .set(bothHeaders)
                .send({
                    wallet: rp.wallet.id,
                    encryptedProof: proof
                })
                .expect(200);
            expect(res.body).to.have.property('isValid');
            expect(res.body.isValid).to.be.true;
        });
    });
});
