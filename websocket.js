/**
 * Websocket Support
 */
'use strict';

const http = require('http');
const WebsocketServer = require('ws').Server;

const config = require('./config');
const log = require('./log');
const Mongoose = require('./db');
const eventBus = require('./eventbus');
const authenticate = require('./middleware/auth');

const Wallet = Mongoose.model('Wallet');

const WS_PING_INTERVAL = config.APP_WS_PING_INTERVAL;

/**
 * Minimal mock of the res object to use with passportjs middleware
 */
class MockRes {
    /**
     * Constructor
     * @param {Promise} promise to resolve / reject on redirect / end call
     */
    constructor(promise) {
        this.headers = {};
        this.statusCode = 0;
        this.promise = promise || new Promise();
    }

    /**
     * Mock res.redirect
     * @param {number} [status]
     * @param {string} location
     */
    redirect(status, location) {
        log.debug('mockRes redirect', status, location);
        if (!location && typeof status === 'string') {
            this.statusCode = 301;
            this.setHeader('location', status);
        } else {
            this.statusCode = status;
            this.setHeader('location', location);
        }
        this.end('redirect');
    }

    /**
     * Mock res.setHeader
     * @param {string} name
     * @param {string} value
     */
    setHeader(name, value) {
        log.debug('mockRes setHeader', name, value);
        this.headers[name] = value;
    }

    /**
     * @param {string} data
     */
    end(data) {
        log.debug('mockRes end', data);
        this.data = data;
        this.promise.reject(this);
    }

    /**
     * Return HTTP response string
     * @return {string}
     */
    toString() {
        let httpString = `HTTP/1.1 ${this.statusCode} ${http.STATUS_CODES[this.statusCode]}\r\n`;
        this.setHeader('Connection', 'close');
        for (let [name, value] of Object.entries(this.headers)) {
            httpString += `${name}:${value}\r\n`;
        }
        httpString += '\r\n';
        if (this.data) httpString += this.data + '\r\n';
        return httpString;
    }
}

/**
 * Callback on Pong message from socket
 * Sets its isAlive property to true
 */
function setAlive() {
    // eslint-disable-next-line no-invalid-this
    this.isAlive = true;
}

/**
 * Noop callback
 */
function noop() {}

/**
 * Ping or terminate connections, called periodically
 */
function livenessCheck() {
    const connEntries = Object.entries(connections);
    let terminateCounter = 0;
    let pingCounter = 0;
    for (let a = connEntries.length - 1; a >= 0; a--) {
        const [userId, conns] = connEntries[a];
        for (let b = conns.length - 1; b >= 0; b--) {
            const conn = conns[b];

            if (conn.isAlive === false) {
                conns.splice(b, 1);
                conn.terminate();
                terminateCounter++;
            } else {
                conn.isAlive = false;
                conn.ping(noop);
                pingCounter++;
            }
        }

        if (connections[userId].length === 0) {
            log.info(`ws: no more connections from user ${userId}, deleting property`);
            delete connections[userId];
        }
    }

    if (terminateCounter + pingCounter > 0) {
        log.info('socket liveness check pinged %d and terminated %d connections', pingCounter, terminateCounter);
    }
}

// key-value map userIds to connections/sockets[]
const connections = {};

module.exports = httpServer => {
    const server = new WebsocketServer({ noServer: true, perMessageDeflate: false });

    setInterval(livenessCheck, WS_PING_INTERVAL);

    eventBus.on('event.created', async event => {
        const message = JSON.stringify(event);
        const wallet = await Wallet.findOne({ _id: event.wallet }).exec();
        if (!wallet) {
            log.info('event with no wallet, returning without sending notifications');
            return;
        }
        [wallet.owner, ...(wallet.users || [])].forEach(userId => {
            if (connections[userId]) {
                connections[userId].forEach(conn => {
                    try {
                        conn.send(message);
                    } catch (err) {
                        log.warn('failed to send event', userId, err, conn);
                    }
                });
            }
        });
    });

    httpServer.on('upgrade', async (req, socket, head) => {
        log.debug('http server received upgrade request');
        try {
            await new Promise((resolve, reject) => {
                const res = new MockRes({ resolve, reject });
                authenticate(req, res, err => (err ? res.promise.reject(err) : res.promise.resolve()));
            });

            if (!req.user) {
                throw new Error('user not found');
            }

            log.info('ws: handle upgrade for user', req.user.username);
            server.handleUpgrade(req, socket, head, function done(ws) {
                server.emit('connection', ws, req);
            });
        } catch (err) {
            log.info('error on http upgrade', err);
            if (err instanceof MockRes) {
                socket.write(err.toString());
            }
            socket.destroy();
        }
    });

    server.on('connection', async (conn, req) => {
        log.debug(`ws: registering connection for user ${req.user.username}`);
        conn.isAlive = true;
        conn.on('pong', setAlive.bind(conn));

        if (!connections[req.user.id]) {
            connections[req.user.id] = [];
        }
        connections[req.user.id].push(conn);

        log.info(`ws: registered connection for user ${req.user.username}`);
    });
};
