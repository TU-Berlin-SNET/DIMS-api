/**
 * Credential Proposal Tests
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
    schema: {
        name: 'Passport-' + testId,
        version: '0.1',
        attrNames: ['firstname', 'lastname', 'age']
    },
    credValues: {
        firstname: 'Alice',
        lastname: 'Doe',
        age: '32'
    },
    credProposal: {
        comment: 'test-proposal-' + testId,
        credentialProposal: {
            attributes: [
                {
                    name: 'firstname',
                    'mime-type': 'string',
                    value: 'Alice'
                },
                {
                    name: 'lastname',
                    'mime-type': 'string',
                    value: 'Doe'
                },
                {
                    name: 'age',
                    'mime-type': 'number',
                    value: 32
                }
            ]
        },
        // these will be populated during test
        recipientDid: '',
        schema: '',
        credentialDefinition: ''
    }
};

const MESSAGE_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/propose-credential';
const PROPOSAL_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/credential-preview';

// testcase-global variables
let steward;
let issuer;
let holder;
let issuerHolderPairwise;
let schema;
let credentialDefinition;
let credentialProposal;

describe.only('credential proposals', function() {
    before(async function() {
        steward = await core.steward(testId);
        issuer = await core.prepareUser(data.issuer);
        holder = await core.prepareUser(data.holder);
        [steward, issuer, holder].forEach(v => valuesToDelete.push({ id: v.id, token: v.token, path: 'user' }));

        // onboard issuer as TRUST_ANCHOR
        const onboarding = core.onboard(
            steward.token,
            issuer.wallet.ownDid,
            issuer.wallet.dids.find(v => v.did === issuer.wallet.ownDid).verkey,
            'TRUST_ANCHOR'
        );

        // establish pairwise connection issuer <-> holder
        const connecting = core.connect(
            issuer.token,
            holder.token
        );

        [, issuerHolderPairwise] = await Promise.all([onboarding, connecting]);

        schema = await core.createSchema(issuer.token, data.schema);

        credentialDefinition = await core.createCredDef(issuer.token, {
            tag: 'noRevoc' + testId,
            schemaId: schema.schemaId,
            supportRevocation: false
        });

        data.credProposal.recipientDid = issuerHolderPairwise['my_did'];
        data.credProposal.schema = schema.schemaId;
        data.credProposal.credentialDefinition = credentialDefinition.credDefId;
    });

    after(async function() {
        await core.clean(valuesToDelete);
    });

    it('should send credential proposal', async function() {
        const res = await core.postRequest('/api/credentialproposal', holder.token, data.credProposal, 201);
        expect(res.body).to.contain.keys('id', 'type', 'threadId', 'message', 'messageId');
        expect(res.body.message).to.contain.keys('@id', '@type', 'credential_proposal', 'schema_id', 'cred_def_id');
        expect(res.body.message).to.have.property('@type', MESSAGE_TYPE);
        expect(res.body.message.credential_proposal).to.have.property('@type', PROPOSAL_TYPE);
    });

    it('should list credential proposal', async function() {
        // need to repeat since message handling may not be finished at this point
        const res = await core.repeat(
            () => core.getRequest('/api/credentialproposal', issuer.token, 200),
            res => res.body.length > 0
        );
        // const res = await core.getRequest('/api/credentialproposal', issuer.token, 200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(1);
        credentialProposal = res.body[0];
    });

    it('should retrieve credential proposal', async function() {
        const res = await core.getRequest('/api/credentialproposal/' + credentialProposal.id, issuer.token, 200);
        expect(res.body).to.contain.keys('id', 'type', 'threadId', 'message', 'messageId');
        expect(res.body).to.have.property('senderDid', issuerHolderPairwise['their_did']);
        expect(res.body).to.have.property('recipientDid', issuerHolderPairwise['my_did']);
        expect(res.body.message).to.contain.keys('@id', '@type', 'credential_proposal', 'schema_id', 'cred_def_id');
        expect(res.body.message.credential_proposal).to.have.property('@type', PROPOSAL_TYPE);
    });

    it('should delete credential proposal', async function() {
        await core.deleteRequest('/api/credentialproposal/' + credentialProposal.id, issuer.token, 204);
    });

    it.skip('should accept credential proposal', async function() {
        // TODO
    });
});
