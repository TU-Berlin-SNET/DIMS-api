/**
 * IDChain Agent REST API
 * API Tests
 * Tests /wallet
 */
'use strict';

const mocha = require('mocha');
const expect = require('chai').expect;
const uuidv4 = require('uuid/v4');
const core = require('./0-test-core');

const { before, after, describe, it } = mocha;
const testId = uuidv4();

const valuesToDelete = [];
// seed must be 32 characters long
const seed = 'testseed' + testId.substring(0, 24);
const data = {
    user: {
        username: 'testuser' + testId,
        password: 'testpassword'
    },
    wallet: {
        name: 'testWallet' + testId,
        seed: seed,
        credentials: {
            key: 'testkey'
        }
    },
    walletFail: {
        name: 'testWalletFail' + testId,
        seed: seed,
        credentials: {
            key: 'testkey'
        }
    }
};
let user;

describe('wallet', function() {
    before(async function() {
        user = await core.prepareUser(data.user);
        valuesToDelete.push({ id: user.id, token: user.token, path: 'user' });
    });

    after(async function() {
        await core.clean(valuesToDelete);
    });

    it('should create a wallet', async function() {
        const res = await core.postRequest('/api/wallet', user.token, data.wallet, 201);
        expect(res.body)
            .to.have.property('id')
            .that.equals(data.wallet.name);
        expect(res.body).to.have.property('ownDid');
        expect(res.body)
            .to.have.property('owner')
            .that.equals(user.id);
    });

    it('create should fail when using same seed (thereby creating duplicate ownDid)', async function() {
        await core.postRequest('/api/wallet', user.token, data.walletFail, 400);
    });

    it('create should fail when using same wallet name', async function() {
        await core.postRequest('/api/wallet', user.token, data.wallet, 400);
    });

    it('should list wallets', async function() {
        const res = await core.getRequest('/api/wallet', user.token, 200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(1);
        expect(res.body[0]).to.contain.keys('id', 'owner', 'users', 'credentials', 'ownDid');
    });

    it('should retrieve specific wallet', async function() {
        const res = await core.getRequest(`/api/wallet/${data.wallet.name}`, user.token, 200);
        expect(res.body).to.have.nested.property('credentials.key');
        expect(res.body)
            .to.have.property('dids')
            .to.be.an('array')
            .with.lengthOf(1);
        expect(res.body)
            .to.have.property('pairwise')
            .to.be.an('array')
            .with.lengthOf(0);
    });

    it('should delete specific wallet', async function() {
        await core.deleteRequest(`/api/wallet/${data.wallet.name}`, user.token, 204);
    });
});
