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

    it('POST /api/connectionoffer should create and return proper connection offer', async function() {
        const res = await agent
            .post('/api/connectionoffer')
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .send({
                endpoint: process.env.APP_ENDPOINT,
                role: 'TRUST_ANCHOR',
                data: {
                    name: 'STEWARD',
                    logo: 'https://www.snet.tu-berlin.de/fileadmin/_processed_/f/fd/csm_logo_gro__4fc44bd1db.jpg'
                }
            })
            .expect(201);
        expect(res.body).to.have.all.keys('id', 'type', 'message');
        expect(res.body.message).to.have.all.keys('did', 'verkey', 'endpoint', 'nonce', 'data');
        expect(res.body.id).to.equal(res.body.message.nonce);
        connectionOffer = res.body;
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
            .set({ Authorization: user.token })
            .expect(200);
        expect(getRes.body)
            .to.have.property('pairwise')
            .that.is.an('Array')
            .with.lengthOf.at.least(1);
        const pairwise = getRes.body.pairwise.filter(v => v['my_did'] === postRes.body.senderDid);
        expect(pairwise)
            .to.be.an('Array')
            .with.lengthOf(1);
    });

    it('POST /api/connectionrequest with no connection offer should send connection request and receiver should store it', async function() {
        const postRes = await agent
            .post('/api/connectionrequest')
            .set(bothHeaders)
            .set({ Authorization: user.token })
            .send({
                endpoint: process.env.APP_ENDPOINT,
                theirDid: steward.wallet.ownDid,
                theirEndpoint: process.env.APP_ENDPOINT
            })
            .expect(200);
        expect(postRes.body.message).to.contain.keys('id', 'type', 'message');
        expect(postRes.body.message.message).to.contain.keys(
            'did',
            'verkey',
            'endpointDid',
            'endpointVk',
            'endpoint',
            'nonce'
        );
        connectionRequest = postRes.body.message;

        const getRes = await agent
            .get('/api/connectionrequest')
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .expect(200);
        expect(getRes.body)
            .to.be.an('Array')
            .with.lengthOf(1);
        expect(getRes.body[0].message).to.eql(connectionRequest);
        connectionRequest = getRes.body[0];
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

    after(async function() {
        valuesToDelete.reverse();
        for (const v of valuesToDelete) {
            if (!v.token) {
                v.token = (await core.login({ username: v.user, password: v.password })).body;
            }
            await agent
                .delete(`/api/${v.path}/${v.id}`)
                .set(bothHeaders)
                .set({ Authorization: v.token })
                .expect(204);
        }
    });
});
