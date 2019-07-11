/**
 * IDChain Agent REST API
 * Connection Response Controller
 */
'use strict';

module.exports = exports = {};

const uuidv4 = require('uuid/v4');
const config = require('../../config');
const lib = require('../../lib');
const log = require('../../log').log;
const domainWallet = require('../../domain-wallet');

const Mongoose = require('../../db');
const Message = Mongoose.model('Message');

const ConnectionService = require('../../services').ConnectionService;
const MessageService = require('../../services').MessageService;

const REQUEST_MESSAGE_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/request';
const RESPONSE_MESSAGE_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/response';

/**
 * Store their did
 * @param {Wallet} wallet
 * @param {string} theirDid their did
 * @param {string} theirVk their verkey
 * @param {object} meta meta
 */
async function storeTheirDid(wallet, theirDid, theirVk, meta) {
    try {
        await lib.sdk.storeTheirDid(wallet.handle, {
            did: theirDid,
            verkey: theirVk
        });
        await lib.did.setMeta(wallet.handle, theirDid, meta);
    } catch (err) {
        // indy error code 213 indicates that the item already exists
        // a previous key_for_did operation might have stored their did in the wallet already
        // so ignore
        if (!err.indyCode || err.indyCode !== 213) {
            throw err;
        }
    }
}

/**
 * Create and send a connection response,
 * i.e. accept a connection request
 * @param {Wallet} wallet
 * @param {(string | object)} connectionOrId connection object or id
 * @return {Promise<Message>} Message - connection request object
 */
exports.create = async (wallet, connectionOrId) => {
    let request = connectionOrId;
    if (typeof connectionOrId === 'string') {
        request = await Message.findOne({
            _id: connectionOrId,
            wallet: wallet.id,
            type: REQUEST_MESSAGE_TYPE
        }).exec();
    }
    if (!request) {
        log.warn('no applicable request found');
        return;
    }
    await request.remove();

    // invitationKey is previous myKey
    const invitation = request.meta.invitation;
    const invitationKey = invitation.recipientKeys[0];
    const myDid = request.meta.invitationMeta.myDid;
    const myKey = await lib.did.localKeyOf(wallet, myDid);
    const diddoc = await lib.diddoc.buildPeerDidDoc(myDid, wallet, domainWallet);
    const connectionField = {
        did: diddoc.id,
        did_doc: diddoc
    };
    const timestamp = Math.floor(Date.now() / 1000);
    const sigDataBuf = Buffer.from(timestamp + JSON.stringify(connectionField), 'utf-8');
    const signatureBuf = await lib.sdk.cryptoSign(wallet.handle, invitationKey, sigDataBuf);
    const response = {
        '@id': uuidv4(),
        '@type': RESPONSE_MESSAGE_TYPE,
        '~thread': { thid: request.threadId },
        'connection~sig': {
            '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/signature/1.0/ed25519Sha512_single',
            signature: signatureBuf.toString('base64'),
            sig_data: sigDataBuf.toString('base64'),
            signer: invitationKey
        }
    };

    const endpoint = await lib.diddoc.getDidcommService(wallet, request.message.connection.did_doc);
    endpoint.senderKey = myKey;
    let connection = ConnectionService.create(wallet, {
        label: invitation.label || uuidv4(),
        state: lib.connection.STATE.RESPONDED,
        stateDirection: lib.connection.STATE_DIRECTION.OUT,
        myDid,
        myKey,
        myDidDoc: diddoc,
        theirDid: request.senderDid,
        theirKey: endpoint.recipientKeys[0],
        theirDidDoc: request.message.connection.did_doc,
        endpoint,
        meta: request.meta.invitationMeta || {}
    });

    connection = await ConnectionService.save(wallet, connection);

    // if we specifically added a role to our offer then this role
    // will be in the request object as this means that this method
    // was called automatically after receiving a connection request
    // through agent-to-agent communication, also see: request.js handle method
    // OR if NYM_ALWAYS flag is set
    if (config.NYM_ALWAYS || (connection.meta && connection.meta.role)) {
        // then write their did on the ledger with that role
        // (this might have implications for GDPR)
        await lib.ledger.nymRequest(
            wallet.handle,
            wallet.ownDid,
            connection.theirDid,
            connection.endpoint.recipientKeys[0],
            null,
            connection.meta.role
        );
        // and if NYM_ALWAYS flag is set, write my did on the ledger as well
        if (config.NYM_ALWAYS) {
            await lib.ledger.nymRequest(wallet.handle, wallet.ownDid, connection.myDid, connection.myKey, null, 'NONE');
        }
    }

    // store connection in wallet
    await storeTheirDid(wallet, connection.theirDid, connection.endpoint.recipientKeys[0], connection.meta);

    // omit senderKey from target so this message is sent
    // anoncrypted since didexchange is not finished yet
    await MessageService.send(wallet, response, {
        recipientKeys: connection.endpoint.recipientKeys,
        routingKeys: connection.endpoint.routingKeys,
        serviceEndpoint: connection.endpoint.serviceEndpoint
    });

    return connection;
};

/**
 * Handle reception of connection response through agent to agent communication
 * @param {Wallet} wallet
 * @param {object} message connection response
 * @param {*} senderVk
 * @param {*} recipientVk
 */
exports.handle = async (wallet, message, senderVk, recipientVk) => {
    log.debug('received connection response', wallet.id, message);
    const request = await Message.findOne({
        wallet: wallet.id,
        type: REQUEST_MESSAGE_TYPE,
        threadId: message['~thread'].thid
    }).exec();
    if (!request || recipientVk !== (await lib.did.localKeyOf(wallet, request.senderDid))) {
        log.debug('no applicable connection found for', message);
        return;
    }
    const sigField = message['connection~sig'];
    const sigDataBuf = Buffer.from(sigField.sig_data, 'base64');
    const signatureBuf = Buffer.from(sigField.signature, 'base64');
    const sigIsValid = await lib.sdk.cryptoVerify(sigField.signer, sigDataBuf, signatureBuf);
    if (!sigIsValid || request.meta.invitationKey !== sigField.signer) {
        log.debug('invalid signature for', message);
        return;
    }
    const sigData = sigDataBuf.toString('utf-8');
    const splitIndex = sigData.indexOf('{');
    const timestamp = Number(sigData.substring(0, splitIndex));
    const theirData = JSON.parse(sigData.substring(splitIndex));

    const [, theirDid] = lib.diddoc.parseDidWithMethod(theirData.did);
    const theirDidDoc = theirData.did_doc;
    const endpoint = await lib.diddoc.getDidcommService(wallet, theirDidDoc);
    endpoint.senderKey = await lib.did.localKeyOf(wallet, request.senderDid);

    const connection = ConnectionService.create(wallet, {
        state: lib.connection.STATE.COMPLETE,
        stateDirection: lib.connection.STATE_DIRECTION.IN,
        label: request.message.label,
        myDid: request.senderDid,
        myKey: recipientVk,
        myDidDoc: request.message.connection.did_doc,
        theirDid,
        theirKey: endpoint.recipientKeys[0],
        theirDidDoc,
        endpoint
    });

    await ConnectionService.save(wallet, connection);

    await storeTheirDid(wallet, connection.theirDid, connection.endpoint.recipientKeys[0], connection.meta);
};

MessageService.registerHandler(RESPONSE_MESSAGE_TYPE, exports.handle);
