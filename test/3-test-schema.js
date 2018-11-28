/**
 * IDChain Agent REST API
 * API Tests
 * Tests /nym
 */
'use strict';

const uuidv4 = require('uuid/v4');
const mocha = require('mocha');
const expect = require('chai').expect;

const core = require('./0-test-core');
const vars = require('./0-test-vars');

const { describe, it, before, after } = mocha;
const agent = vars.agent;
const bothHeaders = vars.bothHeaders;

const steward = {
    username: 'steward' + uuidv4(),
    password: 'pass',
    wallet: {
        name: 'wallet' + uuidv4(),
        seed: '000000000000000000000000Steward1',
        credentials: { key: 'walletkey' }
    }
};

const endpoint = '/api/schema';

const parent = { name: 'Parent' + Buffer.from(uuidv4(), 'utf-8').toString('hex') };
const child = { name: 'Child' + Buffer.from(uuidv4(), 'utf-8').toString('hex') };

describe(endpoint, function() {
    before(async function() {
        steward.id = await core.createUser({ username: steward.username, password: steward.password });
        steward.token = await core.login(steward.username, steward.password);
        steward.wallet.ownDid = (await core.createWallet(steward.token, steward.wallet)).ownDid;
    });
    after(async function() {
        await agent
            .delete('/api/user/' + steward.id)
            .set(bothHeaders)
            .set({ Authorization: steward.token });
    });

    it('initial list of schemas', async function() {
        const res = await agent
            .get(endpoint)
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .expect(200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(0);
    });

    it('create a revocable parent schema', async function() {
        let doc = {
            name: parent.name,
            version: '1.0',
            attributes: [{ name: 'ATTRIBUTE Parent', type: 'string' }],
            isRevocable: true
        };

        const res = await agent
            .post(endpoint)
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .send(doc)
            .expect(201);
        expect(res.body).to.have.property('schemaId');
        parent.id = res.body.schemaId;
    });

    it('create a non-revocable child schema', async function() {
        let doc = {
            name: child.name,
            version: '1.0',
            attributes: [{ name: 'ATTRIBUTE Child', type: 'integer' }],
            parentSchemaId: parent.id,
            isRevocable: false
        };

        const res = await agent
            .post(endpoint)
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .send(doc)
            .expect(201);
        expect(res.body).to.have.property('schemaId');
        child.id = res.body.schemaId;
    });

    it('retrieve existing schema', async function() {
        let res = await agent
            .get(`${endpoint}/${parent.id}`)
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .expect(200);

        res = await agent
            .get(`${endpoint}/${child.id}`)
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .expect(200);
    });

    it('list schemas', async function() {
        const res = await agent
            .get(endpoint)
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .expect(200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(2);
    });

    it('revoke an existing schema', async function() {
        const res = await agent
            .patch(`${endpoint}/${parent.id}`)
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .send({ operation: 'revoke' })
            .expect(204);
    });

    it('list active (non-deprecated) schemas', async function() {
        const res = await agent
            .get(endpoint)
            .query({ onlyActive: 'true' })
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .expect(200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(1);
    });

    // NEGATIVE TESTS

    it('retrieve non-existing schema', async function() {
        const res = await agent
            .get(`${endpoint}/FAKESCHEMAID`)
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .expect(404);
    });

    it('revoke a non-existing schema', async function() {
        const res = await agent
            .patch(`${endpoint}/FAKESCHEMAID`)
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .send({ operation: 'revoke' })
            .expect(422);
    });

    it('revoke a non-revocable schema', async function() {
        const res = await agent
            .patch(`${endpoint}/${child.id}`)
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .send({ operation: 'revoke' })
            .expect(422);
    });

    it('create an already-existing schema', async function() {
        let doc = {
            name: parent.name,
            version: '1.0',
            attributes: []
        };

        const res = await agent
            .post(endpoint)
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .send(doc)
            .expect(409);
    });

    it('create a non-valid schema', async function() {
        let doc = {
            name: 'Schema',
            version: '34', // bad versioning scheme, should be `digits . digits`
            attributes: []
        };

        let res = await agent
            .post(endpoint)
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .send(doc)
            .expect(400);

        doc = {
            name: 'Schema',
            version: '1.0',
            parentSchemaId: parent.id,
            attributes: [{ name: 'ATTRIBUTE Parent', type: 'integer' }] // same name attribute
        };
        res = await agent
            .post(endpoint)
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .send(doc)
            .expect(400);
    });
});
