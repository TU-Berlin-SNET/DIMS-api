/**
 * Tests Websocket Connection and Notifications
 */
'use strict';

const mocha = require('mocha');
const expect = require('chai').expect;
const uuidv4 = require('uuid/v4');
const WebSocket = require('ws');
const core = require('./0-test-core');

const { before, after, describe, it } = mocha;
const testId = uuidv4();

const valuesToDelete = [];
const data = {
    user: {
        username: 'user' + testId,
        password: 'userpass',
        wallet: {
            name: 'userWallet' + testId,
            credentials: { key: 'userpass' }
        }
    }
};

let steward;
let user;
let socket;

describe('websockets', function() {
    before(async function() {
        steward = await core.steward(testId);
        user = await core.prepareUser(data.user);
        valuesToDelete.push({ id: steward.id, token: steward.token, path: 'user' });
        valuesToDelete.push({ id: user.id, token: user.token, path: 'user' });
    });

    after(async function() {
        await core.clean(valuesToDelete);
        socket && socket.close();
    });

    it('connection should fail without authorization header with 401 http code', async function() {
        try {
            socket = new WebSocket(core.wsURL);
            await new Promise((resolve, reject) => {
                socket.on('open', message => reject(new Error(message || 'socket open called')));
                socket.on('close', message => reject(new Error(message || 'socket close called')));
                socket.on('ping', message => reject(new Error(message || 'socket ping called')));
                socket.on('message', message => reject(new Error(message || 'socket message called')));
                socket.on('unexpected-response', (req, res) => {
                    expect(res).to.have.property('statusCode', 401);
                    resolve();
                });
                socket.on('error', err => reject(err || new Error('socket error called')));
            });
        } finally {
            socket && socket.close();
            socket = false;
        }
    });

    it('should connect with valid Authorization header', async function() {
        socket = new WebSocket(core.wsURL, { headers: { Authorization: user.token } });
        await new Promise((resolve, reject) => {
            socket.on('open', err => resolve());
            socket.on('close', message => reject(new Error(message || 'socket close called')));
            socket.on('ping', message => resolve());
            socket.on('message', message => resolve());
            socket.on('error', err => reject(err || new Error('socket error called')));
        });
    });

    it('should receive events', async function() {
        const promise = new Promise((resolve, reject) => {
            socket.once('message', message => {
                resolve(message);
            });
        });
        await core.connect(
            steward.token,
            user.token
        );
        const message = await promise;
        const event = JSON.parse(message);
        expect(event)
            .to.be.an('object')
            .that.includes.keys('id', 'name', 'ref', 'wallet');
    });
});
