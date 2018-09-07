/**
 * IDChain Agent REST API
 * API Tests
 * Tests Authication Layer
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
let users = vars.users;
let valuesToDelete = [];
const User = require('../models/user');

describe('authentication layer', function() {
    before(async function() {
        for (const u of users) {
            const username = u.username;
            await User.remove({ username });

            const res = await agent
                .post('/api/user/')
                .set(bothHeaders)
                .send(u)
                .expect(201);
            const id = res.get('location').substring(6);
            u.id = id;
            valuesToDelete.push({
                id: id,
                auth: [u.username, u.password],
                path: 'user'
            });
        }
    });

    describe('check login endpoint', function() {
        it('should login', async function() {
            for (const u of users) {
                const res = await agent
                    .post('/api/login/')
                    .set(bothHeaders)
                    .send(u)
                    .expect(200);
                let token = res.body.token;
                expect(token).to.be.string;
                u.token = token;
            }
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
