/**
 * IDChain Agent REST API
 * API Tests
 * Tests /user
 */
'use strict';

const mocha = require('mocha');
const expect = require('chai').expect;

const vars = require('./0-test-vars');
const describe = mocha.describe;
const after = mocha.after;
const it = mocha.it;

const agent = vars.agent;
const acceptHeader = vars.acceptHeader;
const bothHeaders = vars.bothHeaders;
let valuesToDelete = [];

const User = require('../models/user');

describe('/api/user', function() {
    let tmpUser = { username: 'willDelete', password: 'afterThis' };

    before(async function() {
        this.timeout(60000);

        let username = tmpUser.username;
        await User.remove({ username });

        const res = await agent
            .post('/api/user')
            .set(bothHeaders)
            .send(tmpUser)
            .expect(201);
        const id = res.get('location').substring(6);
        tmpUser.id = id;
        valuesToDelete.push({ id: id, auth: [tmpUser.username, tmpUser.password], path: 'user' });
    });

    beforeEach(async function() {
        this.timeout(60000);
        const res = await agent
            .post('/api/login')
            .set(bothHeaders)
            .send(tmpUser)
            .expect(200);

        bothHeaders.Authorization = res.body.token;
    });

    it('POST / should return 400 on missing parameter', async function() {
        await agent
            .post('/api/user')
            .set(bothHeaders)
            .send({ username: 'something' })
            .expect(400);
    });

    it('GET /:id should retrieve specific user', async function() {
        const res = await agent
            .get(`/api/user/${tmpUser.id}`)
            .set(bothHeaders)
            .expect(200);
        expect(res.body).to.eql({
            id: tmpUser.id,
            username: tmpUser.username
        });
    });

    it('GET /me should retrieve current user', async function() {
        const res = await agent
            .get('/api/user/me')
            .set(bothHeaders)
            .expect(200);
        expect(res.body).to.eql({
            id: tmpUser.id,
            username: tmpUser.username
        });
    });

    it('GET /otheruser should return 404', async function() {
        await agent
            .get('/api/user/otheruser')
            .set(bothHeaders)
            .expect(404);
    });

    it('PUT /:id should update specific user', async function() {
        await agent
            .put(`/api/user/${tmpUser.id}`)
            .set(bothHeaders)
            .send({ username: 'newName', password: 'newPass' })
            .expect(200);
        const res2 = await agent
            .get(`/api/user/${tmpUser.id}`)
            .auth('newName', 'newPass')
            .set(bothHeaders)
            .expect(200);
        expect(res2.body).to.eql({ id: tmpUser.id, username: 'newName' });
        tmpUser.username = res2.body.username;
        tmpUser.password = 'newPass';
    });

    it('PUT /me with only username should succeed', async function() {
        await agent
            .put(`/api/user/${tmpUser.id}`)
            .set(bothHeaders)
            .send({ username: 'willDelete' })
            .expect(200);
        const res2 = await agent
            .get(`/api/user/${tmpUser.id}`)
            .auth('willDelete', tmpUser.password)
            .set(bothHeaders)
            .expect(200);
        expect(res2.body).to.eql({ id: tmpUser.id, username: 'willDelete' });
        tmpUser.username = res2.body.username;
    });

    it('DELETE /user/:id should delete specific user', async function() {
        await agent
            .delete(`/api/user/${tmpUser.id}`)
            .set(bothHeaders)
            .expect(204);
    });

    after(async function() {
        // clean up
        valuesToDelete.reverse();
        for (const v of valuesToDelete) {
            await agent
                .delete(`/api/${v.path}/${v.id}`)
                .auth(...v.auth)
                .set(acceptHeader);
        }
    });
});
