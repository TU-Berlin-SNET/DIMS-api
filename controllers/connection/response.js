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

const ConnectionService = require('../../services').ConnectionService;
const MessageService = require('../../services').MessageService;

const RESPONSE_MESSAGE_TYPE = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/response';

/**
 * Store their did and create a pairwise
 * @param {Wallet} wallet
 * @param {string} myDid my pairwise did
 * @param {string} theirDid their pairwise did
 * @param {string} theirVk their pairwise verkey
 * @param {object} meta pairwise meta
 */
async function storePairwiseInWallet(wallet, myDid, theirDid, theirVk, meta) {
    try {
        await lib.sdk.storeTheirDid(wallet.handle, {
            did: theirDid,
            verkey: theirVk
        });
    } catch (err) {
        // indy error code 213 indicates that the item already exists
        // a previous key_for_did operation might have stored their did in the wallet already
        // so ignore
        if (!err.indyCode || err.indyCode !== 213) {
            throw err;
        }
    }
    await lib.sdk.createPairwise(wallet.handle, theirDid, myDid, JSON.stringify(meta));
}

/**
 * Create and send a connection response,
 * i.e. accept a connection request
 * @param {Wallet} wallet
 * @param {(string | object)} connectionOrId connection object or id
 * @return {Promise<Message>} Message - connection request object
 */
exports.create = async (wallet, connectionOrId) => {
    let connection = connectionOrId;
    if (typeof connection === 'string') {
        log.debug('retrieving connection by id', connection);
        connection = await ConnectionService.findById(wallet, connection);
    }
    if (!connection) {
        log.warn('connection not applicable or does not exist');
        return;
    }
    if (connection.state === lib.connection.STATE.RESPONDED) {
        // resend response
        log.debug('already responded, resending response');
        await MessageService.send(wallet, connection.response, {
            recipientKeys: connection.endpoint.recipientKeys,
            routingKeys: connection.endpoint.routingKeys,
            serviceEndpoint: connection.endpoint.serviceEndpoint
        });
        return connection;
    }
    if (
        connection.state !== lib.connection.STATE.REQUESTED &&
        connection.stateDirection !== lib.connection.STATE_DIRECTION.IN
    ) {
        log.warn('cannot respond to connection in wrong state');
        // TODO needs better error handling
        return;
    }

    // invitationKey is previous myKey
    const invitationKey = connection.myKey;
    // create new did/key pair for pairwise connection
    const [myDid, myKey] = await lib.did.create(wallet.handle);
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
        '~thread': { thid: connection.threadId },
        'connection~sig': {
            '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/signature/1.0/ed25519Sha512_single',
            signature: signatureBuf.toString('base64'),
            sig_data: sigDataBuf.toString('base64'),
            signer: invitationKey
        }
    };
    connection.myDid = myDid;
    connection.myKey = myKey;
    connection.myDidDoc = diddoc;
    connection.state = lib.connection.STATE.RESPONDED;
    connection.stateDirection = lib.connection.STATE_DIRECTION.OUT;
    connection.response = response;
    // add senderKey to send messages after this one authcrypted
    connection.endpoint = Object.assign({}, connection.endpoint, { senderKey: myKey });
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
    await storePairwiseInWallet(
        wallet,
        connection.myDid,
        connection.theirDid,
        connection.endpoint.recipientKeys[0],
        connection.meta
    );

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
    // TODO validate message, senderVk, recipientVk
    const connection = await ConnectionService.findOne(wallet, {
        threadId: message['~thread'].thid,
        state: lib.connection.STATE.REQUESTED,
        stateDirection: lib.connection.STATE_DIRECTION.OUT
    });
    if (!connection) {
        log.debug('no applicable connection found for', message);
        return;
    }
    const sigField = message['connection~sig'];
    const sigDataBuf = Buffer.from(sigField.sig_data, 'base64');
    const signatureBuf = Buffer.from(sigField.signature, 'base64');
    const sigIsValid = await lib.sdk.cryptoVerify(sigField.signer, sigDataBuf, signatureBuf);
    if (!sigIsValid || connection.theirKey !== sigField.signer) {
        log.debug('invalid signature for', message);
        return;
    }
    const sigData = sigDataBuf.toString('utf-8');
    const splitIndex = sigData.indexOf('{');
    const timestamp = Number(sigData.substring(0, splitIndex));
    const theirData = JSON.parse(sigData.substring(splitIndex));
    connection.response = message;
    connection.theirDidDoc = theirData.did_doc;
    connection.endpoint = await lib.diddoc.getDidcommService(wallet, connection.theirDidDoc);
    [, connection.theirDid] = lib.diddoc.parseDidWithMethod(theirData.did);
    connection.theirKey = connection.endpoint.recipientKeys[0];
    connection.endpoint.senderKey = await lib.did.localKeyOf(wallet, connection.myDid);
    connection.state = lib.connection.STATE.COMPLETE;
    connection.stateDirection = lib.connection.STATE_DIRECTION.IN;

    await ConnectionService.save(wallet, connection);

    await storePairwiseInWallet(
        wallet,
        connection.myDid,
        connection.theirDid,
        connection.endpoint.recipientKeys[0],
        connection.meta
    );
};

MessageService.registerHandler(RESPONSE_MESSAGE_TYPE, exports.handle);
