/**
 * IDChain Agent REST API
 * API Tests
 * Tests connection/relationship establishment
 * and CRUD
 */
'use strict';

const uuidv4 = require('uuid/v4');
const mocha = require('mocha');
const expect = require('chai').expect;

const core = require('./0-test-core');
const vars = require('./0-test-vars');

const describe = mocha.describe;
const before = mocha.before;
const after = mocha.after;
const it = mocha.it;

const agent = vars.agent;
const bothHeaders = vars.bothHeaders;

const testId = uuidv4();
let valuesToDelete = [];
let steward = {
    username: 'steward' + testId,
    password: 'stewardpass',
    wallet: {
        name: 'stewardWallet' + testId,
        credentials: { key: 'stewardpass' },
        seed: '000000000000000000000000Steward1'
    }
};
let user = {
    username: 'user' + testId,
    password: 'userpass',
    wallet: {
        name: 'userWallet' + testId,
        credentials: { key: 'userpass' }
    }
};

let connectionOffer;
let connectionOfferToDelete;
let connectionRequest;

describe('Connection', function() {
    before(async function() {
        steward.id = await core.createUser(steward);
        steward.token = (await core.login({ username: steward.username, password: steward.password })).body.token;
        user.id = await core.createUser(user);
        user.token = (await core.login({ username: user.username, password: user.password })).body.token;
        valuesToDelete.push({ id: steward.id, token: steward.token, path: 'user' });
        valuesToDelete.push({ id: user.id, token: user.token, path: 'user' });

        const res = await agent
            .get('/api/wallet/default')
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .expect(200);
        steward.wallet.ownDid = res.body.ownDid;
    });

    after(async function() {
        await core.clean(valuesToDelete);
    });

    it('POST /api/connectionoffer should create and return proper connection offer', async function() {
        const res = await agent
            .post('/api/connectionoffer')
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .send({
                endpoint: process.env.APP_ENDPOINT,
                role: 'TRUST_ANCHOR',
                meta: {
                    metaId: 'test'
                },
                data: {
                    name: 'STEWARD',
                    logo: 'https://www.snet.tu-berlin.de/fileadmin/_processed_/f/fd/csm_logo_gro__4fc44bd1db.jpg'
                }
            })
            .expect(201);
        expect(res.body).to.have.all.keys('id', 'type', 'message');
        expect(res.body.message).to.have.all.keys('did', 'verkey', 'endpoint', 'nonce', 'data');
        expect(res.body.message).to.not.have.key('meta');
        expect(res.body.id).to.equal(res.body.message.nonce);
        connectionOffer = res.body;
    });

    it('POST /api/connectionoffer should return proper connection offer even with empty body', async function() {
        const res = await agent
            .post('/api/connectionoffer')
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .send()
            .expect(201);
        expect(res.body).to.have.all.keys('id', 'type', 'message');
        expect(res.body.message).to.have.all.keys('did', 'verkey', 'endpoint', 'nonce');
        expect(res.body.id).to.equal(res.body.message.nonce);
        connectionOfferToDelete = res.body;
    });

    it('GET /api/connectionoffer should list connection offers', async function() {
        const res = await agent
            .get('/api/connectionoffer')
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .expect(200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf.at.least(1);
        connectionOfferToDelete = res.body.filter(v => v.messageId === connectionOfferToDelete.id)[0];
    });

    it('DELETE /api/connectionoffer/:id should delete connectionOffer', async function() {
        await agent
            .delete('/api/connectionoffer/' + connectionOfferToDelete.id)
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .expect(204);
    });

    it('POST /api/connectionrequest with connectionoffer should send request / establish connection', async function() {
        const postRes = await agent
            .post('/api/connectionrequest')
            .set(bothHeaders)
            .set({ Authorization: user.token })
            .send({
                endpoint: process.env.APP_ENDPOINT,
                connectionOffer: connectionOffer
            })
            .expect(200);

        const getRes = await agent
            .get('/api/wallet/default')
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .expect(200);
        expect(getRes.body)
            .to.have.property('pairwise')
            .that.is.an('Array')
            .with.lengthOf.at.least(1);
        const pairwise = getRes.body.pairwise.filter(v => v['their_did'] === postRes.body.senderDid);
        expect(pairwise)
            .to.be.an('Array')
            .with.lengthOf(1);
        expect(JSON.parse(pairwise[0].metadata))
            .to.have.property('metaId')
            .that.equals('test');
    });

    it('POST /api/connectionrequest with no connection offer should send connection request', async function() {
        const res = await agent
            .post('/api/connectionrequest')
            .set(bothHeaders)
            .set({ Authorization: user.token })
            .send({
                endpoint: process.env.APP_ENDPOINT,
                theirDid: steward.wallet.ownDid,
                theirEndpoint: process.env.APP_ENDPOINT
            })
            .expect(200);
        expect(res.body.message).to.contain.keys('id', 'type', 'message');
        expect(res.body.message.message).to.contain.keys(
            'did',
            'verkey',
            'endpointDid',
            'endpointVk',
            'endpoint',
            'nonce'
        );
        connectionRequest = res.body.message;
    });

    it('GET /api/connectionrequest should list connection requests', async function() {
        const res = await agent
            .get('/api/connectionrequest')
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .expect(200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(1);
        expect(res.body[0].message).to.eql(connectionRequest);
        connectionRequest = res.body[0];
    });

    it('GET /api/connectionrequest/:connectionRequestId should retrieve one connection request', async function() {
        const res = await agent
            .get('/api/connectionrequest/' + connectionRequest.id)
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .expect(200);
        expect(res.body).to.eql(connectionRequest);
    });

    it('POST /api/connectionresponse should accept a connection request and establish pairwise', async function() {
        const res = await agent
            .post('/api/connectionresponse')
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .send({
                connectionRequestId: connectionRequest.id
            })
            .expect(200);
        const getRes = await agent
            .get('/api/wallet/default')
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .expect(200);
        expect(getRes.body)
            .to.have.property('pairwise')
            .that.is.an('Array')
            .with.lengthOf.at.least(1);
        const pairwise = getRes.body.pairwise.filter(v => v['my_did'] === res.body.message.did);
        expect(pairwise)
            .to.be.an('Array')
            .with.lengthOf(1);
    });
});
