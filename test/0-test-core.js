'use strict';

const vars = require('./0-test-vars');
const agent = vars.agent;
const bothHeaders = vars.bothHeaders;

const User = require('../models/user');
const ConnectionOffer = require('../models/connectionoffer');
const Credential = require('../models/credential');
const CredentialDef = require('../models/credentialdef');
const CredentialReq = require('../models/credentialreq');
const CredentialSchema = require('../models/credentialschema');
const ProofReq = require('../models/proofreq');
const Wallet = require('../models/wallet');

async function createUser(user) {
    let username = user.username;
    await User.remove({ username });

    const res = await agent
        .post('/api/user')
        .set(bothHeaders)
        .send(user)
        .expect(201);
    const id = res.get('location').substring(6);
    user.id = id;
    return id;
}

async function login(user) {
    return await agent
        .post('/api/login')
        .set(bothHeaders)
        .send(user)
        .expect(200);
}

/**
 * Onboard/Write a did to the ledger with specified role
 * @param {string} token Bearer token
 * @param {string} did did to write on ledger
 * @param {string} verkey verkey to write on ledger
 * @param {string} role role to write on ledger
 */
async function onboard(token, did, verkey, role) {
    await agent
        .post('/api/nym')
        .set(bothHeaders)
        .set({ Authorization: token })
        .send({
            did: did,
            verkey: verkey,
            role: role
        })
        .expect(200);
}

/**
 * Establish a pairwise connection between user1 and user2
 * @param {object} user1
 * @param {object} user2
 * @return {Promise<object>} pairwise from user1
 */
async function connect(user1, user2) {
    const offer = await agent
        .post('/api/connectionoffer')
        .set(bothHeaders)
        .set({ Authorization: user1.token })
        .send({
            endpoint: process.env.APP_ENDPOINT
        })
        .expect(201);
    const request = await agent
        .post('/api/connectionrequest')
        .set(bothHeaders)
        .set({ Authorization: user2.token })
        .send({
            endpoint: process.env.APP_ENDPOINT,
            connectionOffer: offer.body.message
        })
        .expect(200);
    const res = await agent
        .get('/api/wallet/default')
        .set(bothHeaders)
        .set({ Authorization: user1.token })
        .expect(200);
    const pairwise = res.body.pairwise.filter(v => v['their_did'] === request.body.senderDid);
    return pairwise[0];
}

/**
 * Clean up after test
 * @param {object[]} valuesToDelete array of objects to delete with {id, token or auth {username, password}, path: 'path'}
 */
async function clean(valuesToDelete) {
    valuesToDelete.reverse();
    for (const v of valuesToDelete) {
        if (!v.token) {
            v.token = (await login({ username: v.auth[0], password: v.auth[1] })).body;
        }
        await agent
            .delete(`/api/${v.path}/${v.id}`)
            .set(bothHeaders)
            .set({ Authorization: v.token })
            .expect(204);
    }
}

async function createWallet(token, wallet) {
    bothHeaders.Authorization = token;
    return await agent
        .post('/api/wallet')
        .set(bothHeaders)
        .send(wallet)
        .expect(201);
}

async function cleanUp() {
    await User.remove({});
    await ConnectionOffer.remove({});
    await Credential.remove({});
    await CredentialDef.remove({});
    await CredentialReq.remove({});
    await CredentialSchema.remove({});
    await ProofReq.remove({});
    await Wallet.remove({});
}

function generateUsers() {
    const randomNumber = Math.round(Math.random() * 100);

    return [
        { username: 'teststeward' + randomNumber, password: 'steward' },
        { username: 'testissuer' + randomNumber, password: 'issuer' },
        { username: 'testholder' + randomNumber, password: 'holder' },
        { username: 'testrelyingpary' + randomNumber, password: 'relyingpary' }
    ];
}

function generateWallets() {
    const randomNumber = new Date().getTime();

    return [
        {
            name: 'teststewardWallet' + randomNumber,
            seed: '000000000000000000000000Steward1',
            credentials: { key: 'teststewardkey' }
        },
        { name: 'testissuerWallet' + randomNumber, credentials: { key: 'testissuerKey' } },
        { name: 'testholderWallet' + randomNumber, credentials: { key: 'testholderKey' } },
        { name: 'testrelyingparywallet' + randomNumber, credentials: { key: 'testrelyingparyKey' } }
    ];
}

module.exports = {
    createUser,
    login,
    createWallet,
    cleanUp,
    generateUsers,
    generateWallets,
    onboard,
    connect,
    clean
};
