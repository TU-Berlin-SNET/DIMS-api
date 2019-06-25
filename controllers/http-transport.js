/**
 * Indy A2A HTTP Transport Controller
 */

const agent = require('superagent');
const log = require('../log').log;
const APIResult = require('../util/api-result');
const MessageService = require('../services').MessageService;

module.exports = exports = {};

let receiveCallback = message => {
    log.info('dummy receive for http transport received', message);
};

exports.receive = async (req, res, next) => {
    try {
        await receiveCallback(req.body);
        return APIResult.accepted();
    } catch (err) {
        log.warn(err);
        return APIResult.badRequest();
    }
};

exports.send = async (address, payload) => {
    return agent
        .post(address)
        .type('application/json')
        .send(payload);
};

exports.onReceive = receiveFn => {
    receiveCallback = receiveFn;
};

MessageService.registerTransport('http', exports);
MessageService.registerTransport('https', exports);
