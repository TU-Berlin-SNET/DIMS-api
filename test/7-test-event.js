/**
 * Tests Event
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
    }
};

let steward;
let user;
let event;

describe('event', function() {
    before(async function() {
        steward = await core.steward(testId);
        user = await core.prepareUser(data.user);
        // send some messages around to populate events
        await core.connect(
            steward.token,
            user.token
        );
        valuesToDelete.push({ id: steward.id, token: steward.token, path: 'user' });
        valuesToDelete.push({ id: user.id, token: user.token, path: 'user' });
    });

    after(async function() {
        await core.clean(valuesToDelete);
    });

    it('should list events', async function() {
        const res = await core.getRequest('/api/event', user.token, 200);
        expect(res.body).to.be.an('Array').that.is.not.empty;
        res.body.forEach(v =>
            expect(v)
                .to.be.an('object')
                .that.includes.keys('id', 'name', 'ref', 'wallet')
        );
        event = res.body[0];
    });

    it('should retrieve event', async function() {
        const res = await core.getRequest('/api/event/' + event.id, user.token, 200);
        expect(res.body).to.eql(event);
    });

    it('should fail on create (post) event', async function() {
        await core.postRequest('/api/event', user.token, {}, 404);
    });

    it('should delete event', async function() {
        await core.deleteRequest('/api/event/' + event.id, user.token, 204);
    });
});
