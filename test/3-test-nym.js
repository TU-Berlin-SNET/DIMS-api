/**
 * IDChain Agent REST API
 * API Tests
 * Tests /nym
 */
'use strict';

const mocha = require('mocha');
const expect = require('chai').expect;
const uuidv4 = require('uuid/v4');
const core = require('./0-test-core');

const { before, after, describe, it } = mocha;
const testId = uuidv4();

let steward;

describe('nym', function() {
    before(async function() {
        steward = await core.steward(testId);
        steward.wallet.verkey = steward.wallet.dids.find(v => v.did === steward.wallet.ownDid).verkey;
    });

    after(async function() {
        await core.clean([{ id: steward.id, token: steward.token, path: 'user' }]);
    });

    it('should retrieve did nym record', async function() {
        const res = await core
            .getRequest('/api/nym/' + steward.wallet.ownDid, steward.token)
            .set({ wallet: steward.wallet.id })
            .expect(200);
        expect(res.body).to.contain.keys('txnTime', 'type', 'identifier', 'dest', 'data');
        expect(res.body.identifier).to.equal(steward.wallet.ownDid);
        expect(res.body.dest).to.equal(steward.wallet.ownDid);
        expect(res.body.data).to.contain.keys('role', 'verkey');
        expect(res.body.data.role).to.equal('2');
    });

    it('should send nym request to ledger', async function() {
        const postBody = {
            wallet: steward.wallet.id,
            did: steward.wallet.ownDid,
            verkey: steward.wallet.verkey,
            role: 'STEWARD'
        };
        await core.postRequest('/api/nym', steward.token, postBody, 200);
    });
});
