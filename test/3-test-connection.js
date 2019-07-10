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
        label: 'label-' + testId,
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
    });

    after(async function() {
        await core.clean(valuesToDelete);
    });

    it('should create a connection offer with meta and data', async function() {
        const res = await core.postRequest('/api/connectionoffer', steward.token, data.offer, 201);
        connectionOffer = res.body;
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
        expect(res.body.meta).to.have.property('metaId', data.offer.meta.metaId);
        expect(res.body.message).to.have.property('label', data.offer.label);
        expect(res.body.message)
            .to.have.property('~attach')
            .that.eqls(data.offer.data);
    });

    it('should create a connection offer with empty request body', async function() {
        const res = await core.postRequest('/api/connectionoffer', steward.token, {}, 201);
        expect(res.body).to.have.property('message');
        connectionOfferToDelete = res.body;
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
    });

    it('should delete a connection offer', async function() {
        await core.deleteRequest('/api/connectionoffer/' + connectionOfferToDelete.id, steward.token, 204);
    });

    it('should accept a connection offer', async function() {
        const postBody = { connectionOffer: connectionOffer.message };
        const res = await core.postRequest('/api/connectionrequest', user.token, postBody, 201);
        connectionRequest = res.body;
    });

    it('should retrieve established connections', async function() {
        const stewardConn = await core.repeat(
            () => core.getRequest('/api/connection/' + connectionOffer.meta.myDid, steward.token),
            res => res.status === 200
        );
        const userConn = await core.repeat(
            () => core.getRequest('/api/connection/' + connectionRequest.senderDid, user.token),
            res => res.status === 200
        );
        pairwise = stewardConn.body;
        expect(stewardConn.body).to.eql({
            my_did: connectionOffer.meta.myDid,
            their_did: connectionRequest.senderDid,
            // will be set to true when an authcrypted message after sending
            // connection response is received
            acknowledged: false
        });
        expect(userConn.body).to.eql({
            my_did: connectionRequest.senderDid,
            their_did: connectionOffer.meta.myDid,
            // set to true when connection response is received
            acknowledged: true
        });
    });

    it('should list connections', async function() {
        const res = await core.getRequest('/api/wallet/default/connection', steward.token, 200);
        expect(res.body)
            .to.be.an('array')
            .with.lengthOf(1);
        expect(res.body[0]).to.eql(pairwise);
    });

    it('should retrieve a connection with theirDid', async function() {
        const res = await core.getRequest('/api/wallet/default/connection/' + pairwise.their_did, steward.token, 200);
        expect(res.body).to.eql(pairwise);
    });

    it.skip('should send initial connection request', async function() {
        // TODO initial requests with no previous invitation (or implicit invitation) are
        // currently not supported
    });

    it.skip('should list connection requests', async function() {
        // TODO
    });

    it.skip('should accept a connection request', async function() {
        // TODO currently unsupported (requests in response to invitation are automatically accepted)
        // and requests using implicit invitations, i.e. public did with diddoc, are currently unsupported
    });
});
