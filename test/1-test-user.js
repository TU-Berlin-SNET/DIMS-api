/**
 * IDChain Agent REST API
 * API Tests
 * Tests /user
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
    username: 'willDelete' + testId,
    password: 'afterThis'
};
let user;

describe('user', function() {
    before(async function() {
        user = await core.prepareUser(data);
        valuesToDelete.push({ id: user.id, token: user.token, path: 'user' });
    });

    after(async function() {
        await core.clean(valuesToDelete);
    });

    it('create should return 400 on missing parameters', async function() {
        await core.postRequest('/api/user', user.token, { username: 'something' }, 400);
    });

    it('should retrieve specific user by id', async function() {
        const res = await core.getRequest(`/api/user/${user.id}`, user.token, 200);
        expect(res.body).to.eql({
            id: user.id,
            username: data.username
        });
    });

    it('should retrieve current user using "me" as id', async function() {
        const res = await core.getRequest('/api/user/me', user.token, 200);
        expect(res.body).to.eql({
            id: user.id,
            username: user.username
        });
    });

    it('should return 404 when trying to retrieve user which does not exist', async function() {
        await core.getRequest('/api/user/otheruser', user.token, 404);
    });

    it('should update specific user', async function() {
        const res = await core.putRequest(
            `/api/user/${user.id}`,
            user.token,
            { username: 'newName', password: 'newPass' },
            200
        );
        expect(res.body).to.eql({ id: user.id, username: 'newName' });
        user.username = res.body.username;
        user.password = 'newPass';
    });

    it('should delete specific user', async function() {
        await core.deleteRequest(`/api/user/${user.id}`, user.token, 204);
        valuesToDelete.splice(valuesToDelete.findIndex(v => v.id === user.id), 1);
    });
});
