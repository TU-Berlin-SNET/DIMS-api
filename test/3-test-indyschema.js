/**
 * IDChain Agent REST API
 * API Tests
 * Tests low level indy schema endpoints
 */
'use strict';

const mocha = require('mocha');
const expect = require('chai').expect;
const uuidv4 = require('uuid/v4');
const core = require('./0-test-core');

const { before, after, describe, it } = mocha;
const testId = uuidv4();

const data = {
    validSchema: {
        name: 'testschema' + testId,
        version: '0.1',
        attrNames: ['testAttribute1', 'testAttribute2']
    },
    invalidSchema: {
        version: '0.1',
        attrNames: ['testAttribute1', 'testAttribute2']
    }
};

let steward;
let schema;

describe('indyschema', function() {
    before(async function() {
        steward = await core.steward(testId);
    });

    after(async function() {
        await core.clean([{ id: steward.id, token: steward.token, path: 'user' }]);
    });

    it('should create a new schema', async function() {
        const res = await core.postRequest('/api/indyschema', steward.token, data.validSchema, 201);
        expect(res.body).to.have.property('name', data.validSchema.name);
        expect(res.body).to.have.property('version', data.validSchema.version);
        expect(res.body).to.have.property('schemaId');
        expect(res.body.data).to.have.property('name', data.validSchema.name);
        expect(res.body.data).to.have.property('version', data.validSchema.version);
        expect(res.body)
            .to.have.property('attrNames')
            .that.has.members(data.validSchema.attrNames);
        schema = res.body;
    });

    it('should fail if name is missing', async function() {
        await core.postRequest('/api/indyschema', steward.token, data.invalidSchema, 400);
    });

    it('should list schemas which belong to wallet', async function() {
        const res = await core.getRequest('/api/indyschema', steward.token, 200);
        expect(res.body)
            .to.be.an('Array')
            .with.lengthOf(1);
        expect(res.body[0]).to.eql(schema);
    });

    it('should retrieve schema by schemaId', async function() {
        const res = await core.getRequest('/api/indyschema/' + schema.schemaId, steward.token, 200);
        expect(res.body).to.have.property('id', schema.data.id);
        expect(res.body).to.have.property('ver', schema.data.ver);
        expect(res.body).to.have.property('name', schema.data.name);
        expect(res.body).to.have.property('seqNo', schema.data.seqNo);
        expect(res.body).to.have.property('version', schema.data.version);
        expect(res.body)
            .to.have.property('attrNames')
            .that.has.members(schema.data.attrNames);
    });
});
