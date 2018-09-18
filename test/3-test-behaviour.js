/**
 * IDChain Agent REST API
 * API Tests
 * Tests onboarding
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
let users = vars.users;
let wallets = vars.wallets;
let valuesToDelete = [];

let issuer;
let holder;
let rp;
let credDefId;
let holderIssuerDid;
let holderRPDid;

describe('behaviour', function() {
    before(async function() {
        users = core.generateUsers();
        wallets = core.generateWallets();

        for (let i = 0; i < users.length; i++) {
            const id = await core.createUser(users[i]);
            const res = await core.login(users[i]);
            users[i].token = res.body.token;
            valuesToDelete.push({ id: id, token: users[i].token, path: 'user' });
        }

        for (let i = 0; i < wallets.length; i++) {
            const token = users[i].token;
            const wallet = wallets[i];

            await core.createWallet(token, wallet);
            const walletRes = await agent
                .get('/api/wallet/default')
                .set(bothHeaders)
                .set({ Authorization: token })
                .expect(200);
            wallets[i] = walletRes.body;
        }
        // set issuer ownDid as TRUST_ANCHOR
        await core.onboard(
            users[0].token,
            wallets[1].ownDid,
            wallets[1].dids.filter(v => v.did === wallets[1].ownDid)[0].verkey,
            'TRUST_ANCHOR'
        );
        // set relying party ownDid as TRUST_ANCHOR
        await core.onboard(
            users[0].token,
            wallets[3].ownDid,
            wallets[3].dids.filter(v => v.did === wallets[3].ownDid)[0].verkey,
            'TRUST_ANCHOR'
        );
        // pairwise connection issuer and holder
        const issuerHolderPairwise = await core.connect(
            users[1],
            users[2]
        );
        holderIssuerDid = issuerHolderPairwise['their_did'];
        // pairwise connection relying party and holder
        const rpHolderPairwise = await core.connect(
            users[3],
            users[2]
        );
        holderRPDid = rpHolderPairwise['their_did'];
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
        it('should prepare variables', async function() {
            issuer = Object.assign({}, users[1], { wallet: wallets[1] });
            holder = Object.assign({}, users[2], { wallet: wallets[2] });
            rp = Object.assign({}, users[3], { wallet: wallets[3] });
        });

        it('issuer should create a schema', async function() {
            bothHeaders.Authorization = issuer.token;
            const res = await agent
                .post('/api/schema')
                .set(bothHeaders)
                .send({
                    wallet: issuer.wallet.id,
                    name: 'Passport-' + uuidv4(),
                    version: '0.1',
                    attrNames: ['firstname', 'lastname', 'yearOfBirth']
                })
                .expect(201);
            expect(res.body).to.have.property('schemaId');
            schemaId = res.body.schemaId;
        });
        it('issuer should create a credential definition', async function() {
            bothHeaders.Authorization = issuer.token;

            const res = await agent
                .post('/api/credentialdef')
                .set(bothHeaders)
                .send({
                    wallet: issuer.wallet.id,
                    schemaId: schemaId,
                    // FIXME add another test WITH revocation as soon as revocation is supported by proofs
                    supportRevocation: false
                })
                .expect(201);
            expect(res.body).to.have.property('credDefId');
            credDefId = res.body.credDefId;
        });
        it('issuer should create a credential offer', async function() {
            bothHeaders.Authorization = issuer.token;
            const res = await agent
                .post('/api/credentialoffer')
                .auth(issuer.username, issuer.password)
                .set(bothHeaders)
                .send({
                    wallet: issuer.wallet.id,
                    recipientDid: holderIssuerDid,
                    credDefId: credDefId
                })
                .expect(201);
            expect(res.body).to.have.property('encryptedCredentialOffer');
            credentialOffer = res.body.encryptedCredentialOffer;
        });
        it('holder should accept credential offer and create credential request', async function() {
            bothHeaders.Authorization = holder.token;
            const res = await agent
                .post('/api/credentialrequest')
                .set(bothHeaders)
                .send({
                    wallet: holder.wallet.id,
                    encryptedCredentialOffer: credentialOffer
                })
                .expect(201);
            expect(res.body).to.have.property('encryptedCredentialRequest');
            credentialRequest = res.body.encryptedCredentialRequest;
        });
        it('issuer should accept credential request and issue credential', async function() {
            bothHeaders.Authorization = issuer.token;
            const res = await agent
                .post('/api/credentialissue')
                .set(bothHeaders)
                .send({
                    wallet: issuer.wallet.id,
                    encryptedCredentialRequest: credentialRequest,
                    values: {
                        firstname: 'Alice',
                        lastname: 'Doe',
                        yearOfBirth: '1999'
                    }
                })
                .expect(201);
            expect(res.body).to.have.property('encryptedCredential');
            credential = res.body.encryptedCredential;
        });
        it('holder should store credential', async function() {
            bothHeaders.Authorization = holder.token;

            const res = await agent
                .post('/api/credential')
                .set(bothHeaders)
                .send({
                    wallet: holder.wallet.id,
                    encryptedCredential: credential
                })
                .expect(200);
            expect(res.body).to.have.property('credentialId');
            credentialId = res.body.credentialId;
        });
        it('holder should be able to retrieve credential', async function() {
            bothHeaders.Authorization = holder.token;

            const res = await agent
                .get(`/api/credential/${credentialId}`)
                .set(bothHeaders)
                .set({ wallet: holder.wallet.id })
                .expect(200);
            expect(res.body).to.be.an('object');
            // TODO add more checks after standardizing output
        });
    });

    describe('proofs', function() {
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

    describe('transactions', function() {
        describe('given a valid user and wallet with a known DID in the ledger', function() {
            it('it should be able to query DOMAIN transactions', async function() {
                const res = await agent
                    .get('/api/transactions')
                    .auth(rp.username, rp.password)
                    .set(bothHeaders)
                    .set({ wallet: rp.wallet.id })
                    .query({ from: 1, to: 11, type: 'domain' })
                    .expect(200);
                expect(typeof res.body).to.equal('object');
                // The domain ledger contains 10 initial transactions: trustee, stewards & trust anchors
                // At least at any moment it should have this transactions if using the docker test pool
                expect(res.body.length).to.equal(10);
            });

            it('it should be able to query POOL transactions', async function() {
                const res = await agent
                    .get('/api/transactions')
                    .auth(rp.username, rp.password)
                    .set(bothHeaders)
                    .set({ wallet: rp.wallet.id })
                    .query({ from: 1, to: 6, type: 'pool' })
                    .expect(200);
                expect(typeof res.body).to.equal('object');
                // The Docker pool has 4 Nodes, therefore it should return 4 pool transactions
                expect(res.body.length).to.equal(4);
            });

            it('it should be able to query CONFIG transactions', async function() {
                const res = await agent
                    .get('/api/transactions')
                    .auth(rp.username, rp.password)
                    .set(bothHeaders)
                    .set({ wallet: rp.wallet.id })
                    .query({ from: 1, to: 5, type: 'config' })
                    .expect(200);
                expect(typeof res.body).to.equal('object');
                // We expect 0 config type transactions
                expect(res.body.length).to.equal(0);
            });
        });
    });
});
