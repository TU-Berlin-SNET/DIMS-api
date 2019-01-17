'use strict';

require('dotenv').config();

const APP_DOMAIN_ENDPOINT =
    process.env.IDC_API_DOMAIN_PROTOCOL +
    '://' +
    (process.env.IDC_API_DOMAIN_HOST || process.env.IDC_API_HOST) +
    (process.env.IDC_API_DOMAIN_PORT || process.env.IDC_API_PORT
        ? `:${process.env.IDC_API_DOMAIN_PORT || process.env.IDC_API_PORT}`
        : '');

const APP_AGENT_ENDPOINT = APP_DOMAIN_ENDPOINT + '/indy';
const APP_TAILS_ENDPOINT = APP_DOMAIN_ENDPOINT + '/tails/';

const NYM_ALWAYS = ['true', 'yes'].includes(process.env.IDC_API_NYM_ALWAYS) ? true : false;

module.exports = {
    APP_DOMAIN_ENDPOINT,
    APP_AGENT_ENDPOINT,
    APP_TAILS_ENDPOINT,
    NYM_ALWAYS
};
