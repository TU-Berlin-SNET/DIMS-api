/**
 * IDChain Agent REST API
 * API Tests
 * Tests transactions
 */
'use strict';

const mocha = require('mocha');
const expect = require('chai').expect;
const uuidv4 = require('uuid/v4');
const core = require('./0-test-core');

const { before, after, describe, it } = mocha;
const testId = uuidv4();

const valuesToDelete = [];
let user;

describe('transactions', function() {
    before(async function() {
        user = await core.steward(testId);
        valuesToDelete.push({ id: user.id, token: user.token, path: 'user' });
    });

    after(async function() {
        await core.clean(valuesToDelete);
    });

    describe('given a valid user and wallet with a known DID in the ledger', function() {
        it('it should be able to query DOMAIN transactions', async function() {
            const res = await core
                .getRequest('/api/transactions', user.token)
                .query({ from: 1, to: 11, type: 'domain' })
                .expect(200);
            expect(typeof res.body).to.equal('object');
            // The domain ledger contains 10 initial transactions: trustee, stewards & trust anchors
            // At least at any moment it should have this transactions if using the docker test pool
            expect(res.body.length).to.equal(10);
        });

        it('it should be able to query POOL transactions', async function() {
            const res = await core
                .getRequest('/api/transactions', user.token)
                .query({ from: 1, to: 6, type: 'pool' })
                .expect(200);
            expect(typeof res.body).to.equal('object');
            // The Docker pool has 4 Nodes, therefore it should return 4 pool transactions
            expect(res.body.length).to.equal(4);
        });

        it('it should be able to query CONFIG transactions', async function() {
            const res = await core
                .getRequest('/api/transactions', user.token)
                .query({ from: 1, to: 5, type: 'config' })
                .expect(200);
            expect(typeof res.body).to.equal('object');
            // We expect 0 config type transactions
            expect(res.body.length).to.equal(0);
        });
    });
});
