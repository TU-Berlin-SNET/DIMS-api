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
    generateWallets
};
