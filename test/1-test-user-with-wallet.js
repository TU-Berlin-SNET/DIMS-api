/**
 * IDChain Agent REST API
 * API Tests
 * Tests /user with wallet
 */
'use strict';

const mocha = require('mocha');
const expect = require('chai').expect;

const core = require('./0-test-core');
const vars = require('./0-test-vars');

const testId = require('uuid/v4')();
const { before, after, describe, it } = mocha;
const agent = vars.agent;
const bothHeaders = vars.bothHeaders;

const users = [
    {
        username: 'user' + testId,
        password: 'userPass',
        wallet: {
            name: 'wallet' + testId,
            credentials: {
                key: 'walletKey'
            }
        }
    },
    {
        username: 'user2' + testId,
        password: 'userPass',
        wallet: {
            name: 'wallet2' + testId,
            credentials: {
                key: 'walletKey'
            }
        }
    }
];
let valuesToDelete = [];

describe('Default Wallet', function() {
    before(async function() {
        for (let i = 0; i < users.length; i++) {
            const id = await core.createUser(users[i]);
            const token = await core.login(users[i].username, users[i].password);
            users[i].id = id;
            users[i].token = token;
            valuesToDelete.push({
                id: id,
                token: users[i].token,
                auth: { username: users[i].username, password: users[i].password },
                path: 'user'
            });
        }
    });

    after(async function() {
        await core.clean(valuesToDelete);
    });

    it('POST /user/ with wallet-name "default" should fail', async function() {
        await agent
            .post('/api/user')
            .set(bothHeaders)
            .send({
                username: 'noneuser' + testId,
                password: 'nonepass' + testId,
                wallet: {
                    name: 'default',
                    credentials: { key: 'defaultkey' }
                }
            })
            .expect(400);
    });

    it('GET /user/:id should return user and its default wallet', async function() {
        const user = users[0];
        const res = await agent
            .get('/api/user/' + user.id)
            .set(bothHeaders)
            .set({ Authorization: user.token })
            .expect(200);
        expect(res.body).to.have.all.keys('id', 'username', 'wallet');
        expect(res.body.wallet).to.equal(user.wallet.name);
    });

    it('GET /wallet/default should return default wallet', async function() {
        const user = users[0];
        const res = await agent
            .get('/api/wallet/default')
            .set(bothHeaders)
            .set({ Authorization: user.token })
            .expect(200);
        expect(res.body).to.contain.keys('id', 'owner', 'users', 'ownDid', 'dids', 'pairwise');
        expect(res.body.owner).to.equal(user.id);
        expect(res.body.users)
            .to.be.an('Array')
            .with.lengthOf(0);
    });

    it('PUT /user/:id should NOT be able to set other users wallet as default', async function() {
        const user = users[1];
        await agent
            .put('/api/user/me')
            .set(bothHeaders)
            .set({ Authorization: user.token })
            .send({
                wallet: users[0].wallet.name
            })
            .expect(404);
    });
});
