'use strict';

require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const log = require('./log').log;

const APP_HOST = process.env.IDC_API_HOST || 'localhost';
const APP_PORT = process.env.IDC_API_PORT || 8000;

const APP_DOMAIN_PROTOCOL = process.env.IDC_API_DOMAIN_PROTOCOL || 'http';
const APP_DOMAIN_HOST = process.env.IDC_API_DOMAIN_HOST || APP_HOST;
const APP_DOMAIN_PORT = process.env.IDC_API_DOMAIN_PORT || APP_PORT;

const APP_DOMAIN_ENDPOINT = `${APP_DOMAIN_PROTOCOL}://${APP_DOMAIN_HOST}:${APP_DOMAIN_PORT}`;
const APP_AGENT_ENDPOINT = APP_DOMAIN_ENDPOINT + '/indy';
const APP_TAILS_ENDPOINT = APP_DOMAIN_ENDPOINT + '/tails/';

const NYM_ALWAYS = ['true', 'yes'].includes(process.env.IDC_API_NYM_ALWAYS) ? true : false;

const POOL_IP = process.env.IDC_POOL_IP;
const POOL_INFOPORT = process.env.IDC_POOL_INFO_PORT || 8001;

const LIB_OPTIONS = {
    logger: log,
    runtimeConfig: { collect_backtrace: true },
    pool: {
        name: process.env.IDC_POOL_NAME || 'testPool',
        config: { genesis_txn: process.env.IDC_API_GENESIS_TXN || path.join('.', 'pool_transactions_genesis') },
        info: { ip: POOL_IP, port: POOL_INFOPORT }
    },
    blobStorage: {
        type: 'default',
        config: {
            base_dir: path.join(process.env.HOME, '.indy_client', 'tails'),
            uri_pattern: ''
        }
    }
};

const DB_HOST = process.env.IDC_API_DB_HOST || 'mongodb';
const DB_PORT = process.env.IDC_API_DB_PORT || '27017';
const DB_USER = process.env.IDC_API_DB_USER || '';
const DB_PASSWORD = process.env.IDC_API_DB_PASSWORD || '';

const SALTROUNDS = parseInt(process.env.IDC_API_SALTROUNDS) || 10;

const JWT_SECRET = process.env.IDC_API_JWT_SECRET || crypto.randomFillSync(Buffer.alloc(32)).toString('base64');

const LOG_LEVEL = process.env.IDC_API_LOG_LEVEL || 'debug';

const WALLETCACHE_TTL = process.env.IDC_API_WALLETCACHE_TTL || 15;

module.exports = {
    APP_HOST,
    APP_PORT,
    APP_DOMAIN_PROTOCOL,
    APP_DOMAIN_HOST,
    APP_DOMAIN_PORT,
    APP_DOMAIN_ENDPOINT,
    APP_AGENT_ENDPOINT,
    APP_TAILS_ENDPOINT,
    NYM_ALWAYS,
    LIB_OPTIONS,
    DB_HOST,
    DB_PORT,
    DB_USER,
    DB_PASSWORD,
    SALTROUNDS,
    JWT_SECRET,
    LOG_LEVEL,
    WALLETCACHE_TTL
};
