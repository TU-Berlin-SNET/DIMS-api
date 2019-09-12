/**
 * Websocket Support
 */
'use strict';

const http = require('http');
const WebsocketServer = require('ws').Server;
const log = require('./log');
const Mongoose = require('./db');
const eventBus = require('./eventbus');
const authenticate = require('./middleware/auth');

const Wallet = Mongoose.model('Wallet');

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

// key-value map user to connections[]
const connections = {};

// TODO think about dead connection detection and cleanup

module.exports = httpServer => {
    const server = new WebsocketServer({ noServer: true, perMessageDeflate: false });

    eventBus.on('event.created', event => {
        const message = JSON.stringify(event);
        (connections[event.wallet] || []).forEach(client => client.send(message));
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

            log.debug('ws: handle upgrade for user', req.user.username);
            server.handleUpgrade(req, socket, head, function done(ws) {
                server.emit('connection', ws, req);
            });
        } catch (err) {
            log.debug('error on http upgrade', err);
            if (err instanceof MockRes) {
                socket.write(err.toString());
            }
            socket.destroy();
        }
    });

    server.on('connection', async (conn, req) => {
        log.debug('ws connection user', req.user.username);

        // find all wallets usable by the user
        const wallets = await Wallet.find({ $or: [{ owner: req.user._id }, { users: req.user._id }] }).exec();
        wallets.forEach(wallet => {
            log.debug(`registering user ${req.user.username} for events of wallet ${wallet.id}`);
            if (!connections[wallet.id]) {
                connections[wallet.id] = [];
            }
            connections[wallet.id].push(conn);
        });

        conn.on('message', message => {
            conn.send('{ "message": "unsupported" }');
        });
    });
};
