/**
 * IDChain Agent REST API
 * API Tests
 * Tests Credential Definition endpoints
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
    schema: {
        name: 'Passport-' + uuidv4(),
        version: '0.1',
        attrNames: ['firstname', 'lastname', 'age']
    },
    credDef: {
        schemaId: '', // will be populated during test preparation
        tag: testId,
        supportRevocation: false
    },
    credDefRevoc: {
        schemaId: '', // will be populated during test preparation
        tag: 'revoc' + testId,
        supportRevocation: true
    }
};

// testcase-global variables
let steward;
let issuer;
let schema;
let credDefRevoc;

describe('credential definitions', function() {
    before(async function() {
        steward = await core.steward(testId);
        issuer = await core.prepareUser(data.issuer);
        [steward, issuer].forEach(v => valuesToDelete.push({ id: v.id, token: v.token, path: 'user' }));

        // onboard issuer as TRUST_ANCHOR
        await core.onboard(
            steward.token,
            issuer.wallet.ownDid,
            issuer.wallet.dids.find(v => v.did === issuer.wallet.ownDid).verkey,
            'TRUST_ANCHOR'
        );

        schema = await core.createSchema(issuer.token, data.schema);
        data.credDef.schemaId = schema.schemaId;
        data.credDefRevoc.schemaId = schema.schemaId;
    });

    after(async function() {
        await core.clean(valuesToDelete);
    });

    it('create credential definition should fail if schemaId is missing', async function() {
        await core.postRequest('/api/credentialdef', issuer.token, { supportRevocation: false }, 400);
    });

    it('should create a credential definition which does NOT support revocation', async function() {
        const res = await core.postRequest('/api/credentialdef', issuer.token, data.credDef, 201);
        expect(res.body).to.have.property('credDefId');
    });

    it('should create a credential definition which supports revocation', async function() {
        const res = await core.postRequest('/api/credentialdef', issuer.token, data.credDefRevoc, 201);
        expect(res.body).to.have.property('credDefId');
        credDefRevoc = res.body;
    });

    it('should list credential definitions', async function() {
        const res = await core.getRequest('/api/credentialdef', issuer.token, 200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(2);
    });

    it('should retrieve credential definition by credDefId', async function() {
        const res = await core.getRequest('/api/credentialdef/' + credDefRevoc.credDefId, issuer.token, 200);
        expect(res.body).to.contain.keys('id', 'schemaId', 'type', 'tag', 'value', 'ver');
    });
});
