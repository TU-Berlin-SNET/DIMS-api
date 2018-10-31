/**
 * IDChain Agent REST API
 * Proofs Controller
 */
'use strict';

const agent = require('superagent');

const lib = require('../../lib');
const log = require('../../log').log;
const pool = require('../../pool');
const Mongoose = require('../../db');
const APIResult = require('../../api-result');

const Message = Mongoose.model('Message');
const messageTypes = lib.message.messageTypes;

module.exports = {};
