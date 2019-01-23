/**
 * IDChain Agent REST API
 * API Tests
 * Tests proof request templates
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
    credential: {
        firstname: 'Alice',
        lastname: 'Doe',
        age: '32'
    }
};
const proofrequestTemplate = `{
    "name": "{{name}}",
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
}`;

let issuer;
let holder;
let relyingparty;
let issuerHolderPairwise;
let relyingpartyHolderPairwise;
let schema;
let credDef;
let proofReqTemplate;

describe('proofrequest-templates', function() {
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
        credDef = await core.createCredDef(issuer.token, {
            tag: 'Passport-' + testId,
            schemaId: schema.schemaId,
            supportRevocation: false
        });

        // issue credentials
        await core.issueCredential(
            issuer.token,
            holder.token,
            issuerHolderPairwise['their_did'],
            credDef.credDefId,
            data.credential
        );
    });

    after(async function() {
        await core.clean(valuesToDelete);
    });

    it('should create a proof request template', async function() {
        const postBody = { template: proofrequestTemplate };
        const res = await core.postRequest('/api/proofrequesttemplate', relyingparty.token, postBody, 201);
        expect(res.body).to.contain.keys('id', 'wallet', 'template');
        expect(res.body.template).to.eql(proofrequestTemplate);
        proofReqTemplate = res.body;
    });

    it('should list proof request templates', async function() {
        const res = await core.getRequest('/api/proofrequesttemplate', relyingparty.token, 200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(1);
        expect(res.body[0]).to.contain.keys('id', 'wallet', 'template');
        expect(res.body[0].template).to.eql(proofrequestTemplate);
    });

    it('should retrieve a proof request template by id', async function() {
        const res = await core.getRequest('/api/proofrequesttemplate/' + proofReqTemplate.id, relyingparty.token, 200);
        expect(res.body).to.eql(proofReqTemplate);
    });

    it('should request and retrieve proof using a proof request template', async function() {
        const templateValues = {
            name: 'Ticket-' + testId,
            credDefId: credDef.credDefId,
            proofAge: 18,
            to: Math.floor(Date.now() / 1000)
        };
        const credValues = {
            phone: '11110000'
        };
        const proof = await core.getProof(
            relyingparty.token,
            holder.token,
            relyingpartyHolderPairwise['their_did'],
            proofReqTemplate.id,
            templateValues,
            credValues
        );
        expect(proof).to.contain.keys('id', 'wallet', 'did', 'proof', 'status', 'isValid');
        expect(proof.did).to.equal(relyingpartyHolderPairwise['their_did']);
        expect(proof.status).to.equal('received');
        expect(proof.isValid).to.be.true;
        expect(proof.proof).to.not.be.null;
    });
});
