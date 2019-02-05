/**
 * IDChain Agent REST API
 * API Tests
 * Tests /schema
 */
'use strict';

const mocha = require('mocha');
const expect = require('chai').expect;
const uuidv4 = require('uuid/v4');
const core = require('./0-test-core');

const { before, after, describe, it } = mocha;
const testId = uuidv4();

let steward;

const endpoint = '/api/schema';
const parent = { name: 'Parent' + Buffer.from(testId, 'utf-8').toString('hex') };
const child = { name: 'Child' + Buffer.from(testId, 'utf-8').toString('hex') };
const data = {
    parentSchema: {
        name: parent.name,
        version: '1.0',
        attributes: [{ name: 'ATTRIBUTE Parent', type: 'string' }],
        isRevocable: true
    },
    childSchema: {
        name: child.name,
        version: '1.0',
        attributes: [{ name: 'ATTRIBUTE Child', type: 'integer' }],
        parentSchemaId: '', // set during test
        isRevocable: false
    },
    invalidExistingSchema: {
        name: parent.name,
        version: '1.0',
        attributes: []
    },
    badVersionSchema: {
        name: 'Schema',
        version: '34', // bad versioning scheme, should be `digits . digits`
        attributes: []
    },
    duplicateNameChildSchema: {
        name: 'Schema',
        version: '1.0',
        parentSchemaId: '', // set during test
        attributes: [{ name: 'ATTRIBUTE Parent', type: 'integer' }] // same name attribute
    },
    op: {
        operation: 'revoke'
    }
};

describe(endpoint, function() {
    before(async function() {
        steward = await core.steward(testId);
    });

    after(async function() {
        await core.clean([{ id: steward.id, token: steward.token, path: 'user' }]);
    });

    it('initial list of schemas', async function() {
        const res = await core.getRequest(endpoint, steward.token, 200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(0);
    });

    it('create a revocable parent schema', async function() {
        const res = await core.postRequest(endpoint, steward.token, data.parentSchema, 201);
        expect(res.body).to.have.property('schemaId');
        parent.id = res.body.schemaId;
        data.childSchema.parentSchemaId = parent.id;
        data.duplicateNameChildSchema.parentSchemaId = parent.id;
    });

    it('create a non-revocable child schema', async function() {
        const res = await core.postRequest(endpoint, steward.token, data.childSchema, 201);
        expect(res.body).to.have.property('schemaId');
        child.id = res.body.schemaId;
    });

    it('retrieve existing schema', async function() {
        await core.getRequest(`${endpoint}/${parent.id}`, steward.token, 200);
        await core.getRequest(`${endpoint}/${child.id}`, steward.token, 200);
    });

    it('list schemas', async function() {
        const res = await core.getRequest(endpoint, steward.token, 200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(2);
    });

    it('revoke an existing schema', async function() {
        await core.patchRequest(`${endpoint}/${parent.id}`, steward.token, data.op, 204);
    });

    it('list active (non-deprecated) schemas', async function() {
        const res = await core
            .getRequest(endpoint, steward.token)
            .query({ onlyActive: 'true' })
            .expect(200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(1);
    });

    // NEGATIVE TESTS

    it('retrieve non-existing schema', async function() {
        await core.getRequest(`${endpoint}/FAKESCHEMAID`, steward.token, 404);
    });

    it('revoke a non-existing schema', async function() {
        await core.patchRequest(`${endpoint}/FAKESCHEMAID`, steward.token, data.op, 422);
    });

    it('revoke a non-revocable schema', async function() {
        await core.patchRequest(`${endpoint}/${child.id}`, steward.token, data.op, 422);
    });

    it('create an already-existing schema', async function() {
        await core.postRequest(endpoint, steward.token, data.invalidExistingSchema, 409);
    });

    it('create a non-valid schema (bad versioning scheme)', async function() {
        await core.postRequest(endpoint, steward.token, data.badVersionSchema, 400);
    });

    it('create a non-valid schema (duplicate attribute name)', async function() {
        await core.postRequest(endpoint, steward.token, data.duplicateNameChildSchema, 400);
    });
});
