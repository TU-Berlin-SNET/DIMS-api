/**
 * Domain/Routing Agent Wallet
 */

const config = require('./config');
const lib = require('./lib');
const log = require('./log');

const wallet = new lib.Wallet(config.WALLET_CONFIG, config.WALLET_CREDENTIALS);

module.exports = exports = wallet;

exports.init = async options => {
    try {
        await wallet.create(config.WALLET_SEED ? { seed: config.WALLET_SEED } : {});
    } catch (err) {
        log.warn(err);
    }
    await wallet.open();
    // TODO do we need additional setup and checks
    // for e.g. serviceEndpoint, recipientKeys, routingKeys, ..?
    return exports;
};

exports.getServiceEndpoint = () => {
    return config.APP_AGENT_ENDPOINT;
};

exports.getServiceEndpointDid = async () => {
    return await wallet.getEndpointDid();
};

exports.getServiceEndpointKey = async () => {
    const serviceEndpointDid = await exports.getServiceEndpointDid();
    return await lib.did.localKeyOf(wallet, serviceEndpointDid);
};
