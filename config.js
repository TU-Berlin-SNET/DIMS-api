'use strict';

require('dotenv').config();

const APP_DOMAIN_ENDPOINT =
    process.env.APP_DOMAIN_PROTOCOL +
    '://' +
    (process.env.APP_DOMAIN_HOST || process.env.APP_HOST) +
    (process.env.APP_DOMAIN_PORT || process.env.APP_PORT
        ? `:${process.env.APP_DOMAIN_PORT || process.env.APP_PORT}`
        : '');

const APP_AGENT_ENDPOINT = APP_DOMAIN_ENDPOINT + '/indy';
const APP_TAILS_ENDPOINT = APP_DOMAIN_ENDPOINT + '/tails/';

const NYM_ALWAYS = ['true', 'yes'].includes(process.env.APP_NYM_ALWAYS) ? true : false;

module.exports = {
    APP_DOMAIN_ENDPOINT,
    APP_AGENT_ENDPOINT,
    APP_TAILS_ENDPOINT,
    NYM_ALWAYS
};
