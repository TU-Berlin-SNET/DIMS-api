/**
 * IDChain Agent REST API
 * API Tests
 * Tests connection/relationship establishment
 * and CRUD
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
    user: {
        username: 'user' + testId,
        password: 'userpass',
        wallet: {
            name: 'userWallet' + testId,
            credentials: { key: 'userpass' }
        }
    },
    offer: {
        role: 'TRUST_ANCHOR',
        meta: {
            metaId: 'test' + testId
        },
        data: {
            name: 'STEWARD',
            logo: 'https://www.snet.tu-berlin.de/fileadmin/_processed_/f/fd/csm_logo_gro__4fc44bd1db.jpg'
        }
    }
};

let steward;
let user;
let connectionOffer;
let connectionOfferToDelete;
let connectionRequest;
let pairwise;

describe('connection', function() {
    before(async function() {
        steward = await core.steward(testId);
        user = await core.prepareUser(data.user);
        valuesToDelete.push({ id: steward.id, token: steward.token, path: 'user' });
        valuesToDelete.push({ id: user.id, token: user.token, path: 'user' });

        // onboard user's ownDid on the ledger for use as endpoint did
        await core.onboard(
            steward.token,
            user.wallet.ownDid,
            user.wallet.dids.find(v => v.did === user.wallet.ownDid).verkey,
            'NONE'
        );
    });

    after(async function() {
        await core.clean(valuesToDelete);
    });

    it('should create a connection offer with meta and data', async function() {
        const res = await core.postRequest('/api/connectionoffer', steward.token, data.offer, 201);
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
        expect(res.body.meta).to.have.property('metaId', data.offer.meta.metaId);
        expect(res.body.messageId).to.equal(res.body.message.message.nonce);
        connectionOffer = res.body;
    });

    it('should create a connection offer with empty request body', async function() {
        const res = await core.postRequest('/api/connectionoffer', steward.token, {}, 201);
        expect(res.body.message).to.contain.keys('id', 'type', 'message');
        expect(res.body.message.message).to.contain.keys('did', 'verkey', 'endpoint', 'nonce');
        expect(res.body.messageId).to.equal(res.body.message.message.nonce);
        connectionOfferToDelete = res.body.message;
    });

    it('should return 404 if retrieving a connection where the pairwise does not exist yet', async function() {
        await core.getRequest('/api/connection/' + connectionOffer.meta.myDid, steward.token, 404);
    });

    it('should return 404 if retrieving a connection where the did does not exist', async function() {
        await core.getRequest('/api/connection/0000DoesNotExist', steward.token, 404);
    });

    it('should list connection offers', async function() {
        const res = await core.getRequest('/api/connectionoffer', steward.token, 200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf.at.least(1);
        connectionOfferToDelete = res.body.find(v => v.messageId === connectionOfferToDelete.id);
    });

    it('should delete a connectionOffer', async function() {
        await core.deleteRequest('/api/connectionoffer/' + connectionOfferToDelete.id, steward.token, 204);
    });

    it('should accept a connection offer', async function() {
        const postBody = { connectionOffer: connectionOffer.message };
        connectionRequest = (await core.postRequest('/api/connectionrequest', user.token, postBody, 200)).body;
    });

    it('should retrieve established connections', async function() {
        const stewardConn = await core.getRequest('/api/connection/' + connectionOffer.meta.myDid, steward.token, 200);
        const userConn = await core.getRequest('/api/connection/' + connectionRequest.senderDid, user.token, 200);
        expect(stewardConn.body).to.have.property('myDid', connectionOffer.meta.myDid);
        expect(stewardConn.body).to.have.property('theirDid', connectionRequest.senderDid);
        expect(stewardConn.body).to.have.property('acknowledged', true);

        expect(userConn.body).to.have.property('myDid', connectionRequest.senderDid);
        expect(userConn.body).to.have.property('theirDid', connectionOffer.meta.myDid);
        expect(userConn.body).to.have.property('acknowledged', true);
    });

    it('should send initial connection request', async function() {
        const postBody = { theirDid: steward.wallet.ownDid, theirEndpoint: core.AGENT_ENDPOINT };
        const res = await core.postRequest('/api/connectionrequest', user.token, postBody, 200);
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

    it('should list connection requests', async function() {
        const res = await core.getRequest('/api/connectionrequest', steward.token, 200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(1);
        expect(res.body[0].message).to.eql(connectionRequest);
        connectionRequest = res.body[0];
    });

    it('should retrieve a connection request with id', async function() {
        const res = await core.getRequest('/api/connectionrequest/' + connectionRequest.id, steward.token, 200);
        expect(res.body).to.eql(connectionRequest);
    });

    it('should accept a connection request', async function() {
        const postBody = { connectionRequestId: connectionRequest.id };
        const res = await core.postRequest('/api/connectionresponse', steward.token, postBody, 200);
        expect(res.body).to.contain.keys('id', 'aud', 'type', 'message');
        expect(res.body.message).to.contain.keys('did', 'verkey', 'nonce');

        pairwise = (await core.getRequest(
            '/api/wallet/default/connection/' + connectionRequest.message.message.did,
            steward.token,
            200
        )).body;
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

    it('should list connections', async function() {
        const res = await core.getRequest('/api/wallet/default/connection', steward.token, 200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(2);
        const conn = res.body.find(v => v['my_did'] === pairwise['my_did']);
        expect(conn).to.eql(pairwise);
    });

    it('should retrieve a connection with theirDid', async function() {
        const res = await core.getRequest(
            '/api/wallet/default/connection/' + pairwise['their_did'],
            steward.token,
            200
        );
        expect(res.body).to.eql(pairwise);
    });
});
