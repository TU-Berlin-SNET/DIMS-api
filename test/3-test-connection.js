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

let stewardConnection;
let userConnection;
let connectionToDelete;

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
        const res = await core.postRequest('/api/connectioninvitation', steward.token, data.offer, 201);
        stewardConnection = res.body;
        expect(res.body).to.have.property('state', 'INVITED');
        expect(res.body)
            .to.have.property('meta')
            .with.property('metaId', data.offer.meta.metaId);
        expect(res.body).to.have.property('invitation');
        expect(res.body.invitation)
            .to.have.property('~attach')
            .that.eqls(data.offer.data);
        expect(res.body).to.have.property('label', data.offer.label);
    });

    it('should create a connection offer with empty request body', async function() {
        const res = await core.postRequest('/api/connectioninvitation', steward.token, {}, 201);
        expect(res.body).to.have.property('state', 'INVITED');
        expect(res.body).to.have.property('invitation');
        connectionToDelete = res.body;
    });

    it('should query connections in INVITED state', async function() {
        const res = await core.getRequest('/api/connection?state=INVITED', steward.token, 200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf.at.least(1);
    });

    it('should delete a connection', async function() {
        await core.deleteRequest('/api/connection/' + connectionToDelete.id, steward.token, 204);
    });

    it('should accept a connection invitation', async function() {
        const postBody = { invitation: stewardConnection.invitation };
        const res = await core.postRequest('/api/connectionrequest', user.token, postBody, 201);
        userConnection = res.body;
        expect(res.body).to.have.property('state', 'REQUESTED');
        expect(res.body).to.contain.keys('myDid', 'myKey', 'invitation', 'request');
    });

    it('should list connections', async function() {
        const stewardConns = (await core.getRequest('/api/connection/', steward.token, 200)).body;
        expect(stewardConns)
            .to.be.an('array')
            .with.lengthOf(1);
        expect(stewardConns[0]).to.contain.keys('id', 'state', 'stateDirection', 'initiator');
    });

    it('should retrieve a connection by id', async function() {
        const res = await core.getRequest('/api/connection/' + stewardConnection.id, steward.token, 200);
        expect(res.body).to.have.property('id', stewardConnection.id);
        expect(res.body).to.contain.keys('id', 'state', 'stateDirection', 'initiator');
    });

    it('should return 404 if retrieving a connection that does not exist', async function() {
        await core.getRequest('/api/connection/DoesNotExist0000', steward.token, 404);
    });

    it('should have established', async function() {
        let userConn;
        for (let i = 1; i <= 3; i++) {
            userConn = await core.getRequest('/api/connection/' + userConnection.id, user.token, 200);
            if (userConn.body.state === 'COMPLETE') {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 333 * i));
        }
        userConn = userConn.body;
        const stewardConn = (await core.getRequest('/api/connection/' + stewardConnection.id, steward.token, 200)).body;
        const connValues = ['state', 'myDid', 'myKey', 'myDidDoc', 'theirDid', 'theirKey', 'theirDidDoc', 'endpoint'];
        expect(userConn).to.have.property('state', 'COMPLETE');
        expect(stewardConn).to.have.property('state', 'RESPONDED');
        expect(userConn).to.contain.keys(...connValues);
        expect(stewardConn).to.contain.keys(...connValues);
        expect(userConn).to.have.property('state', 'COMPLETE');
        expect(stewardConn).to.have.property('state', 'RESPONDED');
        expect(userConn).to.have.property('myDid', stewardConn.theirDid);
        expect(userConn).to.have.property('myKey', stewardConn.theirKey);
        expect(userConn).to.have.property('theirDid', stewardConn.myDid);
        expect(userConn).to.have.property('theirKey', stewardConn.myKey);
        expect(userConn.myDidDoc).to.eql(stewardConn.theirDidDoc);
        expect(userConn.theirDidDoc).to.eql(stewardConn.myDidDoc);
        expect(userConn.endpoint).to.contain.keys('recipientKeys', 'routingKeys', 'serviceEndpoint');
        expect(stewardConn.endpoint).to.contain.keys('recipientKeys', 'routingKeys', 'serviceEndpoint');
    });

    it.skip('should send initial connection request', async function() {
        // TODO initial requests with no previous invitation (or implicit invitation) are
        // currently not supported
    });

    it.skip('should query connection requests', async function() {
        // TODO
    });

    it.skip('should accept a connection request', async function() {
        // TODO currently unsupported (requests in response to invitation are automatically accepted)
        // and requests using implicit invitations, i.e. public did with diddoc, are currently unsupported
    });
});
