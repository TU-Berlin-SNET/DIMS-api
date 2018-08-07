/**
 * IDChain Agent REST API
 * ConnectionOffer and Connection Controller
 */

const indy = require('indy-sdk');
const agent = require('superagent');

const wrap = require('../asyncwrap').wrap;
const log = require('../log').log;
const pool = require('../pool');
const APIResult = require('../api-result');
const ConnectionOffer = require('../models/connectionoffer');

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
        await pool.attribRequest(
            req.wallet.handle,
            toFromDid,
            toFromDid,
            null,
            { endpoint: { ha: req.body.endpoint || ENDPOINT } },
            null
        );
        await indy.createPairwise(req.wallet.handle, connOffer.did, toFromDid);
        next(
            new APIResult(200, {
                myDid: toFromDid,
                theirDid: connOffer.did
            })
        );
    })
};
