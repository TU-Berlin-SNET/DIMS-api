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
const vars = require('./0-test-vars');
const { describe, before, it, after } = mocha;

const agent = vars.agent;
const bothHeaders = vars.bothHeaders;
const testId = uuidv4();

const valuesToDelete = [];
const user = {
    username: 'willDelete' + testId,
    password: 'afterThis'
};

describe('/api/user', function() {
    before(async function() {
        user.id = await core.createUser(user);
        user.token = await core.login(user.username, user.password);
        valuesToDelete.push({ id: user.id, token: user.token, path: 'user' });
    });

    after(async function() {
        await core.clean(valuesToDelete);
    });

    it('POST / should return 400 on missing parameter', async function() {
        await agent
            .post('/api/user')
            .set(bothHeaders)
            .set({ Authorization: user.token })
            .send({ username: 'something' })
            .expect(400);
    });

    it('GET /:id should retrieve specific user', async function() {
        const res = await agent
            .get(`/api/user/${user.id}`)
            .set(bothHeaders)
            .set({ Authorization: user.token })
            .expect(200);
        expect(res.body).to.eql({
            id: user.id,
            username: user.username
        });
    });

    it('GET /me should retrieve current user', async function() {
        const res = await agent
            .get('/api/user/me')
            .set(bothHeaders)
            .set({ Authorization: user.token })
            .expect(200);
        expect(res.body).to.eql({
            id: user.id,
            username: user.username
        });
    });

    it('GET /otheruser should return 404', async function() {
        await agent
            .get('/api/user/otheruser')
            .set(bothHeaders)
            .set({ Authorization: user.token })
            .expect(404);
    });

    it('PUT /:id should update specific user', async function() {
        await agent
            .put(`/api/user/${user.id}`)
            .set(bothHeaders)
            .set({ Authorization: user.token })
            .send({ username: 'newName', password: 'newPass' })
            .expect(200);

        const res = await agent
            .get(`/api/user/${user.id}`)
            .set(bothHeaders)
            .set({ Authorization: user.token })
            .expect(200);
        expect(res.body).to.eql({ id: user.id, username: 'newName' });
        user.username = res.body.username;
        user.password = 'newPass';
    });

    it('DELETE /user/:id should delete specific user', async function() {
        await agent
            .delete(`/api/user/${user.id}`)
            .set(bothHeaders)
            .set({ Authorization: user.token })
            .expect(204);
        valuesToDelete.splice(valuesToDelete.findIndex(v => v.id === user.id), 1);
    });
});
