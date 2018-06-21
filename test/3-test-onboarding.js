/**
 * IDChain Agent REST API
 * API Tests
 * Tests onboarding
 */
'use strict';

const uuidv4 = require('uuid/v4');
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
let wallets = vars.wallets;
let valuesToDelete = [];
let connectionOffer;

let issuer;
let holder;
let rp;
let holderIssuerDid;

describe('behaviour', function() {
  describe('prepare for tests', function() {
    it('should create users', async function() {
      for (const u of users) {
        const res = await agent.post('/api/user/').set(bothHeaders).send(u).expect(201);
        const id = res.get('location').substring(6);
        u.id = id;
        valuesToDelete.push({
          id: id,
          auth: [u.username, u.password],
          path: 'user',
        });
      }
    });
    it('should create wallets', async function() {
      for (let i = 0; i < wallets.length; i++) {
        const res = await agent.post('/api/wallet')
          .auth(users[i].username, users[i].password)
          .set(bothHeaders)
          .send(wallets[i])
          .expect(201);
          expect(res.body).to.have.all.keys(
            'id', 'created', 'poolName', 'ownDid', 'owner', 'xtype', 'config', 'credentials');
          wallets[i] = res.body;
          valuesToDelete.push({
            id: wallets[i].id,
            auth: [users[i].username, users[i].password],
            path: 'wallet',
          });
      }
    });
  });

  describe('onboarding', function() {
    it('steward should create connectionoffers for issuer with role TRUST_ANCHOR', async function() {
      const res = await agent.post('/api/connectionoffer')
        .auth(users[0].username, users[0].password)
        .set(bothHeaders)
        .send({wallet: wallets[0].id, role: 'TRUST_ANCHOR'})
        .expect(201);
      expect(res.body).to.have.all.keys('did', 'nonce', 'role');
      expect(res.body.role).to.equal('TRUST_ANCHOR');
      connectionOffer = res.body;
    });
    it('issuer should accept connectionoffer from steward', async function() {
      const res = await agent.post('/api/connection')
        .auth(users[1].username, users[1].password)
        .set(bothHeaders)
        .send({wallet: wallets[1].id, connectionOffer: connectionOffer})
        .expect(200);
      expect(res.body).to.have.all.keys('myDid', 'theirDid');
    });
    it('issuer should should NOT accept connectionoffer from steward repeatedly', async function() {
      await agent.post('/api/connection')
        .auth(users[1].username, users[1].password)
        .set(bothHeaders)
        .send({wallet: wallets[1].id, connectionOffer: connectionOffer})
        .expect(404);
    });
    it('steward should create connectionoffers for relyingpary with role TRUST_ANCHOR', async function() {
      const res = await agent.post('/api/connectionoffer')
        .auth(users[0].username, users[0].password)
        .set(bothHeaders)
        .send({wallet: wallets[0].id, role: 'TRUST_ANCHOR'})
        .expect(201);
      expect(res.body).to.have.all.keys('did', 'nonce', 'role');
      expect(res.body.role).to.equal('TRUST_ANCHOR');
      connectionOffer = res.body;
    });
    it('relyingpary should accept connectionoffer from steward', async function() {
      const res = await agent.post('/api/connection')
        .auth(users[3].username, users[3].password)
        .set(bothHeaders)
        .send({wallet: wallets[3].id, connectionOffer: connectionOffer})
        .expect(200);
      expect(res.body).to.have.all.keys('myDid', 'theirDid');
    });
    it('issuer (TRUST_ANCHOR) should create connectionoffer for holder with role NONE', async function() {
      const res = await agent.post('/api/connectionoffer')
        .auth(users[1].username, users[1].password)
        .set(bothHeaders)
        .send({wallet: wallets[1].id})
        .expect(201);
      expect(res.body).to.have.all.keys('did', 'nonce', 'role');
      expect(res.body.role).to.equal('NONE');
      connectionOffer = res.body;
    });
    it('holder should accept connectionoffer from issuer', async function() {
      const res = await agent.post('/api/connection')
        .auth(users[2].username, users[2].password)
        .set(bothHeaders)
        .send({wallet: wallets[2].id, connectionOffer: connectionOffer})
        .expect(200);
      expect(res.body).to.have.all.keys('myDid', 'theirDid');
      holderIssuerDid = res.body.myDid;
    });
    it('holder (NONE) should NOT be able to create connectionOffers', async function() {
      await agent.post('/api/connectionoffer')
        .auth(users[2].username, users[2].password)
        .set(bothHeaders)
        .send({wallet: wallets[2].id})
        .expect(400);
    });
  });

  describe('credentials', function() {
    let schemaId;
    let credDefId;
    let credentialOffer;
    let credentialRequest;
    let credential;
    let credentialId;
    it('should prepare variables', async function() {
      issuer = Object.assign({}, users[1], {wallet: wallets[1]});
      holder = Object.assign({}, users[2], {wallet: wallets[2]});
      rp = Object.assign({}, users[3], {wallet: wallets[3]});
    });
    it('issuer should create a schema', async function() {
      const res = await agent.post('/api/schema')
        .auth(issuer.username, issuer.password)
        .set(bothHeaders)
        .send({
          wallet: issuer.wallet.id,
          name: 'Passport-' + uuidv4(),
          version: '0.1',
          attrNames: ['firstname', 'lastname', 'yearOfBirth'],
        }).expect(201);
      expect(res.body).to.have.property('schemaId');
      schemaId = res.body.schemaId;
    });
    it('issuer should create a credential definition', async function() {
      this.timeout(60000);
      const res = await agent.post('/api/credentialdef')
        .auth(issuer.username, issuer.password)
        .set(bothHeaders)
        .send({
          wallet: issuer.wallet.id,
          schemaId: schemaId,
          supportRevocation: false,
        }).expect(201);
      expect(res.body).to.have.property('credDefId');
      credDefId = res.body.credDefId;
    });
    it('issuer should create a credential offer', async function() {
      const res = await agent.post('/api/credentialoffer')
        .auth(issuer.username, issuer.password)
        .set(bothHeaders)
        .send({
          wallet: issuer.wallet.id,
          recipientDid: holderIssuerDid,
          credDefId: credDefId,
        }).expect(201);
      expect(res.body).to.have.property('encryptedCredentialOffer');
      credentialOffer = res.body.encryptedCredentialOffer;
    });
    it('holder should accept credential offer and create credential request', async function() {
      const res = await agent.post('/api/credentialrequest')
        .auth(holder.username, holder.password)
        .set(bothHeaders)
        .send({
          wallet: holder.wallet.id,
          encryptedCredentialOffer: credentialOffer,
        }).expect(201);
      expect(res.body).to.have.property('encryptedCredentialRequest');
      credentialRequest = res.body.encryptedCredentialRequest;
    });
    it('issuer should accept credential request and issue credential', async function() {
      const res = await agent.post('/api/credentialissue')
        .auth(issuer.username, issuer.password)
        .set(bothHeaders)
        .send({
          wallet: issuer.wallet.id,
          encryptedCredentialRequest: credentialRequest,
          values: {
            'firstname': 'Alice',
            'lastname': 'Doe',
            'yearOfBirth': '1999',
          },
        }).expect(201);
      expect(res.body).to.have.property('encryptedCredential');
      credential = res.body.encryptedCredential;
    });
    it('holder should store credential', async function() {
      const res = await agent.post('/api/credential')
        .auth(holder.username, holder.password)
        .set(bothHeaders)
        .send({
          wallet: holder.wallet.id,
          encryptedCredential: credential,
        }).expect(200);
      expect(res.body).to.have.property('credentialId');
      credentialId = res.body.credentialId;
    });
    it('holder should be able to retrieve credential', async function() {
      const res = await agent.get(`/api/credential/${credentialId}`)
        .auth(holder.username, holder.password)
        .set(bothHeaders)
        .expect(200);
      expect(res.body).to.be.an('object');
      // TODO add more checks after standardizing output
    });
  });

  describe('proofs', function() {
    it('relying party should create proof request');
    it('holder should accept proof request and create proof');
    it('relying party should create proof verification');
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
