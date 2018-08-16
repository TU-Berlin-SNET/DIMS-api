/**
 * IDChain Agent REST API
 * ConnectionOffer and Connection Controller
 */

const indy = require('indy-sdk');
const agent = require('superagent');

const wrap = require('../asyncwrap').wrap;
const lib = require('../lib');
const log = require('../log').log;
const pool = require('../pool');
const APIResult = require('../api-result');
const ConnectionOffer = require('../models/connectionoffer');
const Message = require('../models/message');

const ENDPOINT = `${process.env.APP_HOST}:${process.env.APP_PORT}`;

module.exports = {
    create: wrap(async (req, res, next) => {
        const [fromToDid, fromToKey] = await req.wallet.createDid();
        await pool.nymRequest(req.wallet.handle, req.wallet.ownDid, fromToDid, fromToKey);
        await pool.attribRequest(
            req.wallet.handle,
            fromToDid,
            fromToDid,
            null,
            { endpoint: { ha: req.body.endpoint || ENDPOINT, verkey: fromToKey } },
            null
        );
        let connectionOffer = new ConnectionOffer({
            issuerWallet: req.wallet,
            ownDid: fromToDid,
            role: req.body.role || 'NONE'
        });
        connectionOffer = await connectionOffer.save();
        next(
            new APIResult(201, {
                did: connectionOffer.ownDid,
                nonce: connectionOffer.nonce,
                role: connectionOffer.role
            })
        );
    }),

    accept: wrap(async (req, res, next) => {
        const connOffer = req.body.connectionOffer;
        const [toFromDid, toFromKey] = await req.wallet.createDid();
        await indy.setEndpointForDid(req.wallet.handle, toFromDid, req.body.endpoint || ENDPOINT, toFromKey);
        const fromToKey = await indy.keyForDid(pool.handle, req.wallet.handle, connOffer.did);
        const [signature, anonCryptConnRes] = await req.wallet.signAndAnonCrypt(toFromKey, fromToKey, {
            did: toFromDid,
            verkey: toFromKey,
            endpoint: req.body.endpoint || ENDPOINT,
            nonce: connOffer.nonce
        });
        const [recipient] = await indy.getEndpointForDid(req.wallet.handle, pool.handle, connOffer.did);
        const agentResult = await agent
            .post(`http://${recipient}/api/endpoint`)
            .type('application/json')
            .send({
                type: 'anon',
                target: 'accept_connection',
                ref: connOffer.nonce,
                signature: signature,
                message: anonCryptConnRes
            });
        if (agentResult.status !== 200) {
            return next(new APIResult(agentResult.status, { message: agentResult.body }));
        }
        if (connOffer.role !== 'NONE') {
            req.wallet.ownDid = toFromDid;
            await req.wallet.save();
        }
        // ToDo The following line creates indy error with new version of indy-sdk
        //  await indy.storeTheirDid(req.wallet.handle, {did: connOffer.did, verkey: fromToKey});
        await indy.setEndpointForDid(req.wallet.handle, connOffer.did, recipient, fromToKey);
        /* await pool.attribRequest(
            req.wallet.handle,
            toFromDid,
            toFromDid,
            null,
            { endpoint: { ha: req.body.endpoint || ENDPOINT } },
            null
        ); */
        await indy.createPairwise(req.wallet.handle, connOffer.did, toFromDid);
        next(
            new APIResult(200, {
                myDid: toFromDid,
                theirDid: connOffer.did
            })
        );
    }),

    async offer(wallet, message) {
        await Message.store(wallet.id, message.id, message.type, message.message);
        return APIResult.accepted();
    },

    async request(wallet, message) {
        const connOffer = await Message.findOne({
            messageId: message.id,
            wallet: wallet.id
        }).exec();

        // previous offer exists
        if (connOffer) {
            return await module.exports.acceptRequest(wallet, message.message);
        }

        // no previous offer, so just store the request
        await Message.store(wallet.id, message.message.nonce, message.type, message.message);
        return APIResult.accepted();
    },

    async response(wallet, message) {
        // TODO
        return new APIResult(501, { message: 'not implemented' });
    },

    async acknowledgement(wallet, message) {
        // TODO
        return new APIResult(501, { message: 'not implemented' });
    },

    async acceptRequest(wallet, connReq, connOffer) {
        const theirDid = connReq.did;
        let theirVk = connReq.verkey;
        const theirEndpointDid = connReq.endpointDid;
        let theirEndpoint = connReq.theirEndpoint;
        let theirEndpointVk;
        try {
            if (!theirEndpoint) {
                [theirEndpoint, theirEndpointVk] = await indy.getEndpointForDid(
                    wallet.handle,
                    pool.handle,
                    theirEndpointDid
                );
            }
            if (!theirEndpointVk) {
                theirEndpointVk = await indy.keyForDid(pool.handle, wallet.handle, theirEndpointDid);
            }
            if (!theirVk) {
                theirVk = await indy.keyForDid(pool.handle, wallet.handle, theirDid);
            }
        } catch (err) {
            log.warn('failed to retrieve endpoint details', err);
            return new APIResult(400, { message: 'endpoint details missing from request and not found on ledger' });
        }

        const [myDid, myVk] = await indy.createAndStoreMyDid(wallet.handle, {});
        await indy.storeTheirDid(wallet.handle, {
            did: theirDid,
            verkey: theirVk
        });
        await indy.createPairwise(
            wallet.handle,
            theirDid,
            myDid,
            JSON.stringify({
                theirEndpointDid: theirEndpointDid,
                verified: false
            })
        );
        await indy.setEndpointForDid(wallet.handle, theirEndpointDid, theirEndpoint, theirEndpointVk);

        const connRes = lib.connection.createConnectionResponse(
            wallet,
            myDid,
            myVk,
            theirDid,
            theirVk,
            connReq.request_nonce
        );
        // TODO store unencrypted message somewhere?

        connRes.message = await lib.crypto.anonCrypt(theirVk, connRes.message);
        return lib.message.sendAnoncryptMessage(pool.handle, wallet.handle, theirEndpointDid, connRes);
    }
};
