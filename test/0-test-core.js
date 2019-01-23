/**
 * IDChain Agent REST API
 * Test Utils
 */
'use strict';

const supertest = require('supertest');
const config = require('../config');

const serverURL = `http://${process.env.IDC_API_HOST}:${process.env.IDC_API_PORT}`;
const acceptHeader = { Accept: 'application/json' };
const contentHeader = { 'Content-Type': 'application/json' };
const bothHeaders = Object.assign({}, acceptHeader, contentHeader);
const agent = supertest.agent(serverURL).set(bothHeaders);

const stewardSeed = '000000000000000000000000Steward1';
const AGENT_ENDPOINT = config.APP_AGENT_ENDPOINT;

/**
 * Convenience method for superagent/test requests
 * @param {string} method http method
 * @param {string} url
 * @param {string} [token] authorization token
 * @param {object} [body] request body
 * @param {number} [status] expected http response status
 * @return {object} superagentrequest
 */
function request(method, url, token, body, status) {
    let request = agent[method](url);
    if (token) {
        request = request.set({ Authorization: token });
    }
    if (body) {
        request = request.send(body);
    }
    if (status) {
        request = request.expect(status);
    }
    return request;
}

/**
 * Convenience method for superagent/test get requests
 * @param {string} url
 * @param {string} [token] authorization token
 * @param {number} [status] expected http response status
 * @return {object} superagentrequest
 */
function getRequest(url, token, status) {
    return request('get', url, token, null, status);
}

/**
 * Convenience method for superagent/test post requests
 * @param {string} url
 * @param {string} [token] authorization token
 * @param {object} [body] request body
 * @param {number} [status] expected http response status
 * @return {object} superagentrequest
 */
function postRequest(url, token, body, status) {
    return request('post', url, token, body, status);
}

/**
 * Convenience method for superagent/test put requests
 * @param {string} url
 * @param {string} [token] authorization token
 * @param {object} [body] request body
 * @param {number} [status] expected http response status
 * @return {object} superagentrequest
 */
function putRequest(url, token, body, status) {
    return request('put', url, token, body, status);
}

/**
 * Convenience method for superagent/test patch requests
 * @param {string} url
 * @param {string} [token] authorization token
 * @param {object} [body] request body
 * @param {number} [status] expected http response status
 * @return {object} superagentrequest
 */
function patchRequest(url, token, body, status) {
    return request('patch', url, token, body, status);
}

/**
 * Convenience method for superagent/test delete requests
 * @param {string} url
 * @param {string} [token] authorization token
 * @param {number} [status] expected http response status
 * @return {object} superagentrequest
 */
function deleteRequest(url, token, status) {
    return request('delete', url, token, null, status);
}

/**
 * Create and return (populated) steward user
 * @param {string} testId
 */
async function steward(testId) {
    const steward = {
        username: 'steward' + testId,
        password: 'pass',
        wallet: {
            name: 'wallet' + testId,
            seed: stewardSeed,
            credentials: { key: 'walletkey' }
        }
    };
    return await prepareUser(steward);
}

/**
 * Create and return (populated) user
 * @param {object} data user object
 */
async function prepareUser(data) {
    const user = Object.assign({}, data);
    user.id = await createUser(user);
    user.token = await login(user.username, user.password);
    if (data.wallet) {
        user.wallet = await getWallet(user.token);
    }
    return user;
}

/**
 * Create a user (optionally with wallet)
 * @param {object} user post body payload for user creation
 * @return {Promise<string>} user id
 */
async function createUser(user) {
    const res = await postRequest('/api/user', null, user, 201);
    return res.body.id;
}

/**
 * Create a wallet
 * @param {string} token Authorization header bearer token
 * @param {object} wallet post body payload for wallet creation
 * @return {Promise<object>} response body
 */
async function createWallet(token, wallet) {
    const res = await postRequest('/api/wallet', token, wallet, 201);
    return res.body;
}

/**
 * Login with username and password, and return token
 * @param {string} username
 * @param {string} password
 * @return {Promise<string>} jwt
 */
async function login(username, password) {
    const res = await postRequest('/api/login', null, { username, password }, 200);
    return res.body.token;
}

/**
 * Retrieve default wallet
 * @param {string} token Bearer token
 * @return {Promise<object>}
 */
async function getWallet(token) {
    const res = await getRequest('/api/wallet/default', token, 200);
    return res.body;
}

/**
 * Onboard/Write a did to the ledger with specified role
 * @param {string} token Bearer token
 * @param {string} did did to write on ledger
 * @param {string} verkey verkey to write on ledger
 * @param {string} role role to write on ledger
 */
async function onboard(token, did, verkey, role) {
    await postRequest('/api/nym', token, { did, verkey, role }, 200);
}

/**
 * Establish a pairwise connection between user1 and user2
 * @param {object} user1token jwt for user 1
 * @param {object} user2token jwt for user 22
 * @return {Promise<object>} pairwise from user1
 */
async function connect(user1token, user2token) {
    const offer = await postRequest('/api/connectionoffer', user1token, {}, 201);
    const request = await postRequest(
        '/api/connectionrequest',
        user2token,
        { connectionOffer: offer.body.message },
        200
    );
    const res = await getRequest('/api/wallet/default', user1token, 200);
    const pairwise = res.body.pairwise.find(v => v['their_did'] === request.body.senderDid);
    return pairwise;
}

/**
 * Create a low level indy schema
 * @param {string} token Bearer token
 * @param {object} data schema
 * @return {Promise<object>} schema
 */
async function createSchema(token, data) {
    const res = await postRequest('/api/indyschema', token, data, 201);
    return res.body;
}

/**
 * Create a credential definition
 * @param {string} token Bearer token
 * @param {*} data credential definition
 * @return {Promise<object>} { "credDefId": credDefId}
 */
async function createCredDef(token, data) {
    const res = await postRequest('/api/credentialdef', token, data, 201);
    return res.body;
}

/**
 * Issue a credential to recipientDid with values
 * @param {string} token1 issuer bearer token
 * @param {string} token2 holder bearer token
 * @param {string} recipientDid
 * @param {string} credDefId
 * @param {object} values
 * @return {Promise<void>}
 */
async function issueCredential(token1, token2, recipientDid, credDefId, values) {
    // credential offer exchange
    const offerMessage = (await postRequest('/api/credentialoffer', token1, { recipientDid, credDefId }, 201)).body;
    const offer = (await getRequest('/api/credentialoffer', token2, 200)).body.find(
        v => v.message.id === offerMessage.message.id
    );

    // credential request exchange
    const requestMessage = (await postRequest('/api/credentialrequest', token2, { credentialOfferId: offer.id }, 201))
        .body;
    const credentialRequestId = (await getRequest('/api/credentialrequest', token1, 200)).body.find(
        v => v.message.id === requestMessage.message.id
    ).id;

    // issue credential
    return (await postRequest('/api/credential', token1, { credentialRequestId, values }, 201)).body;
}

/**
 * Request, create, and retrieve proof
 * @param {string} token1
 * @param {string} token2
 * @param {string} recipientDid
 * @param {object} proofRequest
 * @param {object} templateValues
 * @param {object} credValues
 */
async function getProof(token1, token2, recipientDid, proofRequest, templateValues, credValues) {
    const reqMessage = (await postRequest(
        '/api/proofrequest',
        token1,
        { recipientDid, proofRequest, templateValues: templateValues || {} },
        201
    )).body;
    const recvMessage = (await getRequest('/api/proofrequest', token2, 200)).body.find(
        v => v.message.id === reqMessage.message.id
    );
    await postRequest('/api/proof', token2, { proofRequestId: recvMessage.id, values: credValues || {} }, 201);
    const proof = (await getRequest('/api/proof/' + reqMessage.meta.proofId, token1, 200)).body;
    return proof;
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
        await deleteRequest(`/api/${v.path}/${v.id}`, v.token, 204);
    }
}

module.exports = {
    agent,
    bothHeaders,
    serverURL,
    stewardSeed,
    AGENT_ENDPOINT,
    request,
    getRequest,
    postRequest,
    putRequest,
    patchRequest,
    deleteRequest,
    steward,
    createUser,
    createWallet,
    login,
    getWallet,
    prepareUser,
    onboard,
    connect,
    createSchema,
    createCredDef,
    issueCredential,
    getProof,
    clean
};
