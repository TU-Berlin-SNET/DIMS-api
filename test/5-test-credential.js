/**
 * IDChain Agent REST API
 * API Tests
 * Tests credential endpoints
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
        name: 'Passport-' + uuidv4(),
        version: '0.1',
        attrNames: ['firstname', 'lastname', 'age']
    },
    credValues: {
        firstname: 'Alice',
        lastname: 'Doe',
        age: '32'
    }
};

// testcase-global variables
let steward;
let issuer;
let holder;
let issuerHolderPairwise;
let schema;
let credDef;
let credDefWithRevoc;
let credentialOffer;
let credentialRequest;
let credentialMessage;
let credential;
let credRevoc;

describe('credentials', function() {
    before(async function() {
        steward = await core.steward(testId);
        issuer = await core.prepareUser(data.issuer);
        holder = await core.prepareUser(data.holder);
        [steward, issuer, holder].forEach(v => valuesToDelete.push({ id: v.id, token: v.token, path: 'user' }));

        // onboard issuer as TRUST_ANCHOR
        // and holder as NONE (to use ownDid as endpoint did for communication)
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
            )
        ]);

        // establish pairwise connection issuer <-> holder
        issuerHolderPairwise = await core.connect(
            issuer.token,
            holder.token
        );

        schema = await core.createSchema(issuer.token, data.schema);
        [credDef, credDefWithRevoc] = await Promise.all([
            core.createCredDef(issuer.token, {
                tag: 'noRevoc' + testId,
                schemaId: schema.schemaId,
                supportRevocation: false
            }),
            core.createCredDef(issuer.token, {
                tag: 'revoc' + testId,
                schemaId: schema.schemaId,
                supportRevocation: true
            })
        ]);
    });

    after(async function() {
        await core.clean(valuesToDelete);
    });

    it('should send credential offer', async function() {
        const postBody = {
            wallet: issuer.wallet.id,
            recipientDid: issuerHolderPairwise['their_did'],
            credDefId: credDef.credDefId
        };
        const res = await core.postRequest('/api/credentialoffer', issuer.token, postBody, 201);
        expect(res.body).to.contain.keys('id', 'type', 'message', 'messageId');
        expect(res.body.message.message).to.contain.keys('schema_id', 'cred_def_id', 'nonce', 'key_correctness_proof');
        expect(res.body.messageId).to.equal(res.body.message.message.nonce);
    });

    it('should list received credential offers', async function() {
        const res = await core.getRequest('/api/credentialoffer', holder.token, 200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(1);
        expect(res.body[0]).to.contain.keys('id', 'type', 'message', 'messageId');
        credentialOffer = res.body[0];
    });

    it('should accept credential offer and send credential request', async function() {
        const postBody = { credentialOfferId: credentialOffer.id };
        const res = await core.postRequest('/api/credentialrequest', holder.token, postBody, 201);
        expect(res.body).to.contain.keys('id', 'type', 'message', 'messageId');
        expect(res.body.message.message).to.contain.keys(
            'prover_did',
            'cred_def_id',
            'blinded_ms',
            'blinded_ms_correctness_proof',
            'nonce'
        );
    });

    it('should list received credential requests', async function() {
        const res = await core.getRequest('/api/credentialrequest', issuer.token, 200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(1);
        expect(res.body[0]).to.contain.keys('id', 'type', 'message', 'messageId');
        credentialRequest = res.body[0];
    });

    it('should accept credential request and send credential', async function() {
        const postBody = {
            credentialRequestId: credentialRequest.id,
            values: data.credValues
        };
        const res = await core.postRequest('/api/credential', issuer.token, postBody, 201);
        expect(res.body).to.contain.keys('id', 'type', 'message', 'messageId');
        expect(res.body.message.message).to.contain.keys('schema_id', 'cred_def_id', 'values');
        credentialMessage = res.body;
    });

    it('should issue credential which supports revocation', async function() {
        credRevoc = await core.issueCredential(
            issuer.token,
            holder.token,
            issuerHolderPairwise['their_did'],
            credDefWithRevoc.credDefId,
            data.credValues
        );
    });

    it('should revoke a credential', async function() {
        await core.postRequest(`/api/credential/${credRevoc.id}/revoke`, issuer.token, {}, 200);
    });

    it('should list issued credentials', async function() {
        const res = await core.getRequest('/api/credential', issuer.token, 200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(2);
        expect(res.body.find(v => v.message.id === credentialMessage.message.id)).to.eql(credentialMessage);
    });

    it('should filter issued credentials by recipientDid', async function() {
        const res = await core.getRequest(
            '/api/credential?recipientDid=' + issuerHolderPairwise['their_did'],
            issuer.token,
            200
        );
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(2);
    });

    it('should retrieve issued credential message by id', async function() {
        const res = await core.getRequest('/api/credential/' + credentialMessage.id, issuer.token, 200);
        expect(res.body).to.eql(credentialMessage);
    });

    it('should list (received) credentials in wallet', async function() {
        const res = await core.getRequest('/api/wallet/default/credential', holder.token, 200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(2);
        res.body.forEach(cred => {
            expect(cred).to.contain.keys('referent', 'schema_id', 'cred_def_id', 'cred_rev_id', 'rev_reg_id', 'attrs');
            expect(cred.attrs).to.eql(data.credValues);
        });
        credential = res.body[0];
    });

    it('should retrieve received credential by id / referent', async function() {
        const res = await core.getRequest('/api/wallet/default/credential/' + credential.referent, holder.token, 200);
        expect(res.body).to.eql(credential);
    });
});
