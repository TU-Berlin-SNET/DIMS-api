/**
 * IDChain Agent REST API
 * API Tests
 * Tests Authication Layer
 */
'use strict';

const uuidv4 = require('uuid/v4');
const mocha = require('mocha');
const expect = require('chai').expect;

const core = require('./0-test-core');
const vars = require('./0-test-vars');
const { describe, before, it, after } = mocha;

const agent = vars.agent;
const bothHeaders = vars.bothHeaders;
const valuesToDelete = [];

const testId = uuidv4();
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
            const res = await agent
                .post('/api/login/')
                .set(bothHeaders)
                .send(user)
                .expect(200);
            let token = res.body.token;
            expect(token).to.be.string;
            user.token = token;
        });

        it('should not login', async function() {
            await agent
                .post('/api/login/')
                .set(bothHeaders)
                .send({
                    username: 'Gary',
                    password: 'Morry'
                })
                .expect(401);
        });
    });
});
