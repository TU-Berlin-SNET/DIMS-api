/**
 * IDChain Agent REST API
 * API Tests
 * Tests /nym
 */
'use strict';

const mocha = require('mocha');
const expect = require('chai').expect;

const core = require('./0-test-core');
const vars = require('./0-test-vars');

const { describe, it, before, after } = mocha;
const agent = vars.agent;
const bothHeaders = vars.bothHeaders;

const nonce = require('../nonce').uuidv4hex();
const steward = {
    username: 'steward' + nonce,
    password: 'pass',
    wallet: {
        name: 'wallet' + nonce,
        seed: '000000000000000000000000Steward1',
        credentials: { key: 'walletkey' }
    }
};

describe('/api/nym', function() {
    before(async function() {
        this.timeout(60000);
        const user = { username: steward.username, password: steward.password };
        steward.id = await core.createUser(user);
        steward.token = (await core.login(user)).body.token;
        steward.wallet.ownDid = (await core.createWallet(steward.token, steward.wallet)).body.ownDid;
    });

    it('GET /api/nym/:did should retrieve did nym record', async function() {
        const res = await agent
            .get('/api/nym/' + steward.wallet.ownDid)
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .set({ wallet: steward.wallet.name })
            .expect(200);
        expect(res.body).to.contain.keys('txnTime', 'type', 'identifier', 'dest', 'data');
        expect(res.body.identifier).to.equal(steward.wallet.ownDid);
        expect(res.body.dest).to.equal(steward.wallet.ownDid);
        expect(res.body.data).to.contain.keys('role', 'verkey');
        expect(res.body.data.role).to.equal('2');
        steward.wallet.verkey = res.body.data.verkey;
    });

    it('POST /api/nym/:did should send nym request to ledger', async function() {
        await agent
            .post('/api/nym')
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .send({
                wallet: steward.wallet.name,
                did: steward.wallet.ownDid,
                verkey: steward.wallet.verkey,
                role: 'STEWARD'
            })
            .expect(200);
    });

    after(async function() {
        this.timeout(60000);
        await agent
            .delete('/api/user/' + steward.id)
            .set(bothHeaders)
            .set({ Authorization: steward.token })
            .expect(204);
    });
});
