/**
 * IDChain Agent REST API
 * API Tests
 * Tests /user with wallet
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
    user1: {
        username: 'user' + testId,
        password: 'userPass',
        wallet: {
            name: 'wallet' + testId,
            credentials: {
                key: 'walletKey'
            }
        }
    },
    user2: {
        username: 'user2' + testId,
        password: 'userPass',
        wallet: {
            name: 'wallet2' + testId,
            credentials: {
                key: 'walletKey'
            }
        }
    },
    failUser: {
        username: 'noneuser' + testId,
        password: 'nonepass' + testId,
        wallet: {
            name: 'default',
            credentials: { key: 'defaultkey' }
        }
    }
};
const users = [];

describe('user with default wallet', function() {
    before(async function() {
        users[0] = await core.prepareUser(data.user1);
        users[1] = await core.prepareUser(data.user2);
        users.forEach(v => valuesToDelete.push({ id: v.id, token: v.token, path: 'user' }));
    });

    after(async function() {
        await core.clean(valuesToDelete);
    });

    it('should fail when trying to create wallet with wallet-name "default"', async function() {
        await core.postRequest('/api/user', null, data.failUser, 400);
    });

    it('should retrieve user and its default wallet', async function() {
        const res = await core.getRequest('/api/user/' + users[0].id, users[0].token, 200);
        expect(res.body).to.have.all.keys('id', 'username', 'wallet');
        expect(res.body.wallet).to.equal(users[0].wallet.id);
    });

    it('should retrieve default wallet', async function() {
        const res = await core.getRequest('/api/wallet/default', users[0].token, 200);
        expect(res.body).to.contain.keys('id', 'owner', 'users', 'ownDid', 'dids', 'pairwise');
        expect(res.body.owner).to.equal(users[0].id);
        expect(res.body.users)
            .to.be.an('Array')
            .with.lengthOf(0);
    });

    it('should NOT be able to set other users wallet as default', async function() {
        await core.putRequest('/api/user/me', users[1].token, { wallet: users[0].wallet.id }, 404);
    });
});
