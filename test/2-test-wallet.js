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

describe('/api/wallet', function() {
    let testuser;
    let testwallet;

    before(async function() {
        testuser = { username: 'testuser' + Math.random(), password: 'testpassword' };
        testwallet = { name: 'testwallet' + Math.random(), credentials: { key: 'testkey' } };

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
        testwallet = res.body;
    });

    it('GET /:id should retrieve specific wallet', async function() {
        const resWallet = await agent
            .post('/api/wallet')
            .set(bothHeaders)
            .send(testwallet)
            .expect(201);
        testwallet = resWallet.body;

        const res = await agent
            .get(`/api/wallet/${testwallet.id}`)
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
        const resWallet = await agent
            .post('/api/wallet')
            .set(bothHeaders)
            .send(testwallet)
            .expect(201);
        testwallet = resWallet.body;

        await agent
            .delete(`/api/wallet/${testwallet.id}`)
            .set(bothHeaders)
            .expect(204);
    });
});
