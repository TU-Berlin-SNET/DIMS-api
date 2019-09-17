'use strict';

require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const logger = require('./log');

module.exports = exports = {};

exports.APP_HOST = process.env.IDC_API_HOST || 'localhost';
exports.APP_PORT = process.env.IDC_API_PORT || 8000;

exports.APP_DOMAIN_PROTOCOL = process.env.IDC_API_DOMAIN_PROTOCOL || 'http';
exports.APP_DOMAIN_HOST = process.env.IDC_API_DOMAIN_HOST || exports.APP_HOST;
exports.APP_DOMAIN_PORT = process.env.IDC_API_DOMAIN_PORT || exports.APP_PORT;

exports.APP_DOMAIN_ENDPOINT = `${exports.APP_DOMAIN_PROTOCOL}://${exports.APP_DOMAIN_HOST}:${exports.APP_DOMAIN_PORT}`;
exports.APP_AGENT_ENDPOINT = exports.APP_DOMAIN_ENDPOINT + '/indy';
exports.APP_TAILS_ENDPOINT = exports.APP_DOMAIN_ENDPOINT + '/tails/';

exports.APP_WS_PING_INTERVAL = process.env.IDC_API_WS_PING_INTERVAL || 30000;

exports.NYM_ALWAYS = ['true', 'yes'].includes(process.env.IDC_API_NYM_ALWAYS) ? true : false;

exports.POOL_IP = process.env.IDC_POOL_IP;
exports.POOL_INFOPORT = process.env.IDC_POOL_INFO_PORT || 8001;

exports.LIB_OPTIONS = {
    logger,
    runtimeConfig: { collect_backtrace: true },
    pool: {
        name: process.env.IDC_POOL_NAME || 'testPool',
        config: { genesis_txn: process.env.IDC_API_GENESIS_TXN || path.join('.', 'pool_transactions_genesis') },
        info: { ip: exports.POOL_IP, port: exports.POOL_INFOPORT }
    },
    blobStorage: {
        type: 'default',
        config: {
            base_dir: path.join(process.env.HOME, '.indy_client', 'tails'),
            uri_pattern: ''
        }
    }
};

exports.DB_HOST = process.env.IDC_API_DB_HOST || 'mongodb';
exports.DB_PORT = process.env.IDC_API_DB_PORT || '27017';
exports.DB_USER = process.env.IDC_API_DB_USER || '';
exports.DB_PASSWORD = process.env.IDC_API_DB_PASSWORD || '';

exports.SALTROUNDS = parseInt(process.env.IDC_API_SALTROUNDS) || 10;

exports.JWT_SECRET = process.env.IDC_API_JWT_SECRET || crypto.randomFillSync(Buffer.alloc(32)).toString('base64');

exports.LOG_LEVEL = process.env.IDC_API_LOG_LEVEL || 'debug';

exports.WALLETCACHE_TTL = process.env.IDC_API_WALLETCACHE_TTL || 15;

exports.WALLET_ID = process.env.API_WALLET_ID || 'domain-wallet';
exports.WALLET_KEY = process.env.API_WALLET_KEY || 'domain-wallet-key';
exports.WALLET_SEED = process.env.API_WALLET_SEED;

exports.WALLET_CONFIG = {
    id: exports.WALLET_ID
};

exports.WALLET_CREDENTIALS = {
    key: exports.WALLET_KEY
};
