'use strict';

const vars = require('./0-test-vars');
const agent = vars.agent;
const bothHeaders = vars.bothHeaders;

/**
 * Create a user (optionally with wallet)
 * @param {object} user post body payload for user creation
 * @return {Promise<string>} user id
 */
async function createUser(user) {
    const res = await agent
        .post('/api/user')
        .set(bothHeaders)
        .send(user)
        .expect(201);
    return res.body.id;
}

/**
 * Create a wallet
 * @param {string} token Authorization header bearer token
 * @param {object} wallet post body payload for wallet creation
 * @return {Promise<object>} response body
 */
async function createWallet(token, wallet) {
    const res = await agent
        .post('/api/wallet')
        .set(bothHeaders)
        .set({ Authorization: token })
        .send(wallet)
        .expect(201);
    return res.body;
}

/**
 * Login with username and password, and return token
 * @param {string} username
 * @param {string} password
 * @return {Promise<string>} jwt
 */
async function login(username, password) {
    const res = await agent
        .post('/api/login')
        .set(bothHeaders)
        .send({ username: username, password: password })
        .expect(200);
    return res.body.token;
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
 * @param {object} user1token jwt for user 1
 * @param {object} user2token jwt for user 22
 * @return {Promise<object>} pairwise from user1
 */
async function connect(user1token, user2token) {
    const offer = await agent
        .post('/api/connectionoffer')
        .set(bothHeaders)
        .set({ Authorization: user1token })
        .send({
            endpoint: process.env.APP_ENDPOINT
        })
        .expect(201);
    const request = await agent
        .post('/api/connectionrequest')
        .set(bothHeaders)
        .set({ Authorization: user2token })
        .send({
            endpoint: process.env.APP_ENDPOINT,
            connectionOffer: offer.body.message
        })
        .expect(200);
    const res = await agent
        .get('/api/wallet/default')
        .set(bothHeaders)
        .set({ Authorization: user1token })
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
            v.token = await login(v.auth[0], v.auth[1]);
        }
        await agent
            .delete(`/api/${v.path}/${v.id}`)
            .set(bothHeaders)
            .set({ Authorization: v.token })
            .expect(204);
    }
}

module.exports = {
    createUser,
    createWallet,
    login,
    onboard,
    connect,
    clean
};
