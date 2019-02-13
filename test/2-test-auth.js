/**
 * IDChain Agent REST API
 * API Tests
 * Tests Authication Layer
 */
'use strict';

const mocha = require('mocha');
const expect = require('chai').expect;
const uuidv4 = require('uuid/v4');
const core = require('./0-test-core');

const { before, after, describe, it } = mocha;
const testId = uuidv4();

const valuesToDelete = [];
const user = {
    username: 'authtestuser' + testId,
    password: 'authtestuserpassword'
};

describe('authentication layer', function() {
    before(async function() {
        user.id = await core.createUser(user);
        valuesToDelete.push({ id: user.id, auth: [user.username, user.password], path: 'user' });
    });

    after(async function() {
        await core.clean(valuesToDelete);
    });

    describe('check login endpoint', function() {
        it('should login', async function() {
            const res = await core.postRequest('/api/login', null, user, 200);
            expect(res.body.token).to.be.string;
            user.token = res.body.token;
        });

        it('should not login', async function() {
            await core.postRequest('/api/login', null, { username: 'Gary', password: 'Morry' }, 401);
        });
    });
});
