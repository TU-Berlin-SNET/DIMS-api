/**
 * IDChain Agent REST API
 * API Tests
 * Tests /wallet
 */
'use strict';

const mocha = require('mocha');
const expect = require('chai').expect;

const vars = require('./0-test-vars');
const core = require('./0-test-core');
const { describe, it, before, after } = mocha;

const agent = vars.agent;
const bothHeaders = vars.bothHeaders;
let valuesToDelete = [];
const testId = require('uuid/v4')();
// seed must be 32 characters long
const testSeed = 'testseed' + testId.substring(0, 24);

const testuser = {
    username: 'testuser' + testId,
    password: 'testpassword'
};
const testwallet = {
    name: 'testWallet' + testId,
    seed: testSeed,
    credentials: {
        key: 'testkey'
    }
};
const testwalletFail = {
    name: 'testWalletFail' + testId,
    seed: testSeed,
    credentials: {
        key: 'testkey'
    }
};

describe('/api/wallet', function() {
    before(async function() {
        const id = await core.createUser(testuser);
        const res = await core.login(testuser);
        testuser.token = res.body.token;
        valuesToDelete.push({ id: id, token: testuser.token, path: 'user' });
        bothHeaders.Authorization = testuser.token;
    });

    after(async function() {
        await core.clean(valuesToDelete);
    });

    it('POST / should create a wallet', async function() {
        const res = await agent
            .post('/api/wallet')
            .set(bothHeaders)
            .send(testwallet)
            .expect(201);
        expect(res.body)
            .to.have.property('id')
            .that.equals(testwallet.name);
        expect(res.body).to.have.property('ownDid');
        expect(res.body)
            .to.have.property('owner')
            .that.equals(testuser.id);
    });

    it('POST / should fail when using same seed and creating same ownDid', async function() {
        await agent
            .post('/api/wallet')
            .set(bothHeaders)
            .send(testwalletFail)
            .expect(400);
    });

    it('POST / should fail when using same wallet name', async function() {
        await agent
            .post('/api/wallet')
            .set(bothHeaders)
            .send(testwallet)
            .expect(400);
    });

    it('GET / should list wallets', async function() {
        const res = await agent
            .get('/api/wallet')
            .set(bothHeaders)
            .expect(200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(1);
        expect(res.body[0]).to.contain.keys('id', 'owner', 'users', 'credentials', 'ownDid');
    });

    it('GET /:id should retrieve specific wallet', async function() {
        const res = await agent
            .get(`/api/wallet/${testwallet.name}`)
            .set(bothHeaders)
            .expect(200);
        expect(res.body).to.have.nested.property('credentials.key');
        expect(res.body)
            .to.have.property('dids')
            .to.be.an('array')
            .with.lengthOf(1);
        expect(res.body)
            .to.have.property('pairwise')
            .to.be.an('array')
            .with.lengthOf(0);
    });

    it('DELETE /:id should delete specific wallet', async function() {
        await agent
            .delete(`/api/wallet/${testwallet.name}`)
            .set(bothHeaders)
            .expect(204);
    });
});
