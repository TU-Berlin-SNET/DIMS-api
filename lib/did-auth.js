const did = require('./did');
const crypto = require('./crypto');
const message = require('./indy-message');

module.exports = exports = {};

exports.buildRequest = async (wallet, myDid) => {
    const verkey = await did.localKeyOf(wallet, myDid);
    const challenge = {
        nonce: await crypto.getNonce()
    };
    const request = {
        id: await crypto.getNonce(),
        origin: myDid,
        type: message.messageTypes.DIDAUTHREQUEST,
        // 'challenge~sig': await crypto.wrapSigField(wallet, challenge, verkey)
        message: await crypto.wrapSigField(wallet, challenge, verkey)
    };
    return request;
};

exports.buildResponse = async (wallet, pairwise, request) => {
    const requestData = await crypto.unwrapSigField(request.message);
    const responseData = {
        nonce: requestData.nonce,
        did: pairwise['my_did']
    };
    const myKey = await did.localKeyOf(wallet, pairwise['my_did']);
    const response = {
        id: request.id,
        origin: pairwise['my_did'],
        type: message.messageTypes.DIDAUTHRESPONSE,
        message: await crypto.wrapSigField(wallet, responseData, myKey)
    };
    return response;
};
