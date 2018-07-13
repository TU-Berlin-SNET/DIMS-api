/**
 * IDChain Agent REST API
 * API Tests
 * Tests /wallet
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

describe('/api/wallet', function() {
  let testuser = {username: 'testuser'+Math.random(), password: 'testpassword'};
  let testwallet = {name: 'testwallet'+Math.random(), credentials: { key: 'testkey'}};

  it('should prepare user for wallet tests', async function() {
    const res = await agent.post('/api/user/').set(acceptHeader).send(testuser).expect(201);
    const id = res.get('location').substring(6);
    testuser.id = id;
    valuesToDelete.push({id: id, auth: [testuser.username, testuser.password], path: 'user'});
  });

  it('POST / should create a wallet', async function() {
    this.timeout(60000);
    const res = await agent.post('/api/wallet').set(bothHeaders)
    .auth(testuser.username, testuser.password)
    .send(testwallet)
    .expect(201);
    expect(res.body).to.have.property('id').that.equals(testwallet.name);
    expect(res.body).to.have.property('poolName').that.equals('sandbox');
    expect(res.body).to.have.property('ownDid');
    expect(res.body).to.have.property('owner').that.equals(testuser.id);
    expect(res.body).to.have.property('xtype').that.is.null;
    expect(res.body).to.have.property('config').that.is.null;
    //expect(res.body).to.have.property('credentials').that.equals({key:'testkey'});
    testwallet = res.body;
    valuesToDelete.push({
      id: testwallet.id,
      auth: [testuser.username, testuser.password], path: 'wallet',
    });
  });

  it('GET /:id should retrieve specific wallet', async function() {
    const res = await agent.get(`/api/wallet/${testwallet.id}`)
      .auth(testuser.username, testuser.password)
      .set(bothHeaders)
      .expect(200);
    //expect(res.body).to.include(testwallet);
    expect(res.body).to.have.nested.property('credentials.key');
    expect(res.body).to.have.property('dids').to.be.an('array').with.lengthOf(1);
    expect(res.body).to.have.property('pairwise').to.be.an('array').with.lengthOf(0);
  });

  it('DELETE /:id should delete specific wallet', async function() {
    this.timeout(60000)
    await agent.delete(`/api/wallet/${testwallet.id}`)
      .auth(testuser.username, testuser.password)
      .set(acceptHeader)
      .expect(204);
  });

  after(async function() {
    // clean up
    valuesToDelete.reverse();
    for (const v of valuesToDelete) {
      await agent.delete(`/api/${v.path}/${v.id}`)
        .auth(...v.auth).set(acceptHeader);
    }
  });
});
