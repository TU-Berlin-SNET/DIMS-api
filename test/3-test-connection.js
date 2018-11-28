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
    let pairwise;

    before(async function() {
        steward.id = await core.createUser(steward);
        steward.token = await core.login(steward.username, steward.password);
        user.id = await core.createUser(user);
        user.token = await core.login(user.username, user.password);
        valuesToDelete.push({ id: steward.id, token: steward.token, path: 'user' });
        valuesToDelete.push({ id: user.id, token: user.token, path: 'user' });

        const res = await agent
            .get('/api/wallet/default')
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .expect(200);
        steward.wallet.ownDid = res.body.ownDid;

        // onboard user's ownDid on the ledger for use as endpoint did
        const res2 = await agent
            .get('/api/wallet/default')
            .set(bothHeaders)
            .set({ Authorization: user.token })
            .expect(200);
        user.wallet.ownDid = res2.body.ownDid;
        await core.onboard(
            steward.token,
            user.wallet.ownDid,
            res2.body.dids.find(v => v.did === user.wallet.ownDid).verkey,
            'NONE'
        );
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
        expect(res.body).to.contain.keys(
            'id',
            'wallet',
            'messageId',
            'type',
            'senderDid',
            'recipientDid',
            'message',
            'meta'
        );
        expect(res.body.message).to.contain.keys('id', 'type', 'message');
        expect(res.body.message.message).to.contain.keys('did', 'verkey', 'endpoint', 'nonce', 'data');
        expect(res.body.meta).to.have.property('myDid');
        expect(res.body.messageId).to.equal(res.body.message.message.nonce);
        connectionOffer = res.body;
    });

    it('GET /api/connection/:myDid should return 404 if pairwise does not exist yet', async function() {
        await agent
            .get('/api/connection/' + connectionOffer.meta.myDid)
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .expect(404);
    });

    it('GET /api/connection/:myDid should return 404 if did does not exist', async function() {
        await agent
            .get('/api/connection/0000DoesNotExist')
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .expect(404);
    });

    it('POST /api/connectionoffer should return proper connection offer even with empty body', async function() {
        const res = await agent
            .post('/api/connectionoffer')
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .send()
            .expect(201);
        expect(res.body.message).to.contain.keys('id', 'type', 'message');
        expect(res.body.message.message).to.contain.keys('did', 'verkey', 'endpoint', 'nonce');
        expect(res.body.messageId).to.equal(res.body.message.message.nonce);
        connectionOfferToDelete = res.body.message;
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
                connectionOffer: connectionOffer.message
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

    it('GET /api/connection/:myDid should return proper status for accepted connectionOffer / established connection', async function() {
        const res = await agent
            .get('/api/connection/' + connectionOffer.meta.myDid)
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .expect(200);
        expect(res.body).to.have.property('theirDid').that.is.not.empty;
        expect(res.body).to.have.property('acknowledged', true);
    });

    it('POST /api/connectionrequest with no connection offer should send connection request', async function() {
        const res = await agent
            .post('/api/connectionrequest')
            .set(bothHeaders)
            .set({ Authorization: user.token })
            .send({
                theirDid: steward.wallet.ownDid,
                theirEndpoint: vars.AGENT_ENDPOINT
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
        pairwise = getRes.body.pairwise.find(v => v['my_did'] === res.body.message.did);
        expect(pairwise).to.be.an('Object');
        expect(pairwise).to.contain.keys('my_did', 'their_did', 'metadata');
    });

    it('should list connections', async function() {
        const res = await agent
            .get('/api/wallet/default/connection')
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .expect(200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(2);
        pairwise = res.body.find(v => v['my_did'] === pairwise['my_did']);
        expect(pairwise).to.be.an('Object');
        expect(pairwise).to.contain.keys('my_did', 'their_did', 'metadata');
        expect(pairwise.metadata).to.be.an('Object');
        expect(pairwise.metadata).to.contain.keys(
            'theirEndpointDid',
            'theirEndpointVk',
            'theirEndpoint',
            'acknowledged'
        );
        expect(pairwise.metadata.acknowledged).to.be.true;
    });

    it('should retrieve connection by theirDid', async function() {
        const res = await agent
            .get('/api/wallet/default/connection/' + pairwise['their_did'])
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .expect(200);
        expect(res.body).to.eql(pairwise);
    });
});
