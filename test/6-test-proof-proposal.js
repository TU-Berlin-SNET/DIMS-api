/**
 * Proof/Presentation Proposal Tests
 */
'use strict';

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
    verifier: {
        username: 'testverifier' + testId,
        password: 'verifier',
        wallet: { name: 'testverifierWallet' + testId, credentials: { key: 'testverifierKey' } }
    },
    schema: {
        name: 'Passport-' + testId,
        version: '0.1',
        attrNames: ['firstname', 'lastname', 'age']
    },
    credentialData: {
        firstname: 'Alice',
        lastname: 'Doe',
        age: '32'
    }
};

data.validProposal = {
    comment: 'test-valid-proposal-' + testId,
    attributes: [
        {
            name: 'firstname',
            cred_def_id: 'populate during runtime',
            value: data.credentialData.firstname
        },
        {
            name: 'lastname',
            cred_def_id: 'populate during runtime',
            value: data.credentialData.lastname
        },
        {
            name: 'self-attest',
            value: 'self-attested attribute value'
        }
    ],
    predicates: [
        {
            name: 'age',
            cred_def_id: 'populate during runtime',
            predicate: '>=',
            threshold: 20
        }
    ],
    recipientDid: 'populated during runtime'
};

data.invalidProposal = {
    comment: 'test-invalid-proposal-' + testId,
    predicates: [
        {
            name: 'age',
            predicate: '>='
        }
    ],
    recipientDid: 'populated during runtime'
};

let issuer;
let holder;
let verifier;
let issuerHolderPairwise;
let verifierHolderPairwise;
let schema;
let credDef;
let proofProposal;
let proof;

describe('proof proposals', function() {
    before(async function() {
        const steward = await core.steward(testId);
        issuer = await core.prepareUser(data.issuer);
        holder = await core.prepareUser(data.holder);
        verifier = await core.prepareUser(data.verifier);
        [steward, issuer, holder, verifier].forEach(v =>
            valuesToDelete.push({ id: v.id, token: v.token, path: 'user' })
        );

        // onboard issuer as TRUST_ANCHOR
        await core.onboard(
            steward.token,
            issuer.wallet.ownDid,
            issuer.wallet.dids.find(v => v.did === issuer.wallet.ownDid).verkey,
            'TRUST_ANCHOR'
        );

        [issuerHolderPairwise, verifierHolderPairwise] = await Promise.all([
            // establish pairwise connection issuer <-> holder
            core.connect(
                issuer.token,
                holder.token
            ),
            // establish pairwise connection verifier <-> holder
            core.connect(
                verifier.token,
                holder.token
            )
        ]);

        // create schema and credDef
        schema = await core.createSchema(issuer.token, data.schema);
        credDef = await core.createCredDef(issuer.token, {
            tag: 'Passport-' + testId,
            schemaId: schema.schemaId,
            supportRevocation: false
        });

        // issue credential
        await core.issueCredential(
            issuer.token,
            holder.token,
            issuerHolderPairwise['their_did'],
            credDef.credDefId,
            data.credentialData
        );

        // populate some test data
        [data.validProposal, data.invalidProposal].forEach(v => {
            for (const attr of [...(v.attributes || []), ...(v.predicates || [])]) {
                if (attr.cred_def_id) {
                    attr.cred_def_id = credDef.credDefId;
                }
            }
            v.recipientDid = verifierHolderPairwise['my_did'];
        });
    });

    after(async function() {
        await core.clean(valuesToDelete);
    });

    it('should return 400 on invalid proof proposal', async function() {
        await core.postRequest('/api/proofproposal', holder.token, data.invalidProposal, 400);
    });

    it('should create/send proof proposal', async function() {
        const res = await core.postRequest('/api/proofproposal', holder.token, data.validProposal, 201);
        expect(res.body).to.contain.keys('id', 'type', 'threadId', 'message', 'messageId');
        expect(res.body.message).to.contain.keys('@id', '@type', 'presentation_proposal');
        expect(res.body.message.presentation_proposal).to.contain.keys('@type', 'attributes', 'predicates');
    });

    it('should list received proof proposals', async function() {
        const res = await core.repeat(
            () => core.getRequest('/api/proofproposal', verifier.token, 200),
            res => res.body.length > 0
        );
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(1);
        proofProposal = res.body[0];
    });

    it('should accept proof proposal and create/send proof request', async function() {
        const postBody = {
            comment: 'test-proof-request-' + testId,
            recipientDid: verifierHolderPairwise['their_did'],
            proofProposal: proofProposal.id
        };
        const res = await core.postRequest('/api/proofrequest', verifier.token, postBody, 201);
        expect(res.body).to.contain.keys('id', 'type', 'threadId', 'message', 'messageId', 'meta');
        expect(res.body.meta).to.have.property('proofId');
        proof = { id: res.body.meta.proofId };
    });

    it('proof request should have been auto-accepted and proof received', async function() {
        const res = await core.repeat(
            () => core.getRequest('/api/proof/' + proof.id, verifier.token, 200),
            res => res.body.status === 'received'
        );
        expect(res.body.did).to.equal(verifierHolderPairwise['their_did']);
        expect(res.body.status).to.equal('received');
        expect(res.body.proof).to.not.be.null;
        expect(res.body.isValid).to.be.true;
    });
});
