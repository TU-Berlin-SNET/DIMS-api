/**
 * API Tests
 * Tests did-auth
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
    didauthRequest: {
        meta: { testId }
    }
};

let steward;
let user;
let stewardUserPairwise;
let didauthRequest;

describe('did-auth', function() {
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

        stewardUserPairwise = await core.connect(
            steward.token,
            user.token,
            { did: steward.wallet.ownDid }
        );
    });

    after(async function() {
        await core.clean(valuesToDelete);
    });

    it('should create did-auth request', async function() {
        const res = await core.postRequest('/api/didauthrequest', steward.token, data.didauthRequest, 201);
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
        expect(res.body.meta).to.have.property('testId', testId);
        expect(res.body.message).to.contain.keys('id', 'type', 'origin', 'message');
        expect(res.body.message.message).to.contain.keys('@type', 'signature', 'sig_data', 'signer');
        didauthRequest = res.body.message;
    });

    it('should create did-auth reponse', async function() {
        const res = await core.postRequest('/api/didauthresponse', user.token, { request: didauthRequest }, 201);
        expect(res.body.message).to.contain.keys('id', 'type', 'origin', 'message');
        expect(res.body.message.message).to.contain.keys('@type', 'signature', 'sig_data', 'signer');
    });

    it('should retrieve did-auth response', async function() {
        const res = await core.getRequest('/api/didauthresponse', steward.token, 200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(1);
        const response = res.body[0];
        expect(response.meta).to.have.property('testId', testId);
        expect(response.meta).to.have.property('isValid', true);
        expect(response.message).to.contain.keys('id', 'type', 'origin', 'message');
        expect(response.message).to.have.property('origin', stewardUserPairwise['their_did']);
        expect(response.message.message).to.contain.keys('@type', 'signature', 'sig_data', 'signer');
    });
});
