/**
 * IDChain Agent REST API
 * Agent Endpoint Controller
 */

const indy = require('indy-sdk');

const pool = require('../pool');
const Wallet = require('../models/wallet');
const ConnectionOffer = require('../models/connectionoffer');
const WalletProvider = require('../middleware/walletProvider');
const wrap = require('../asyncwrap').wrap;
const APIResult = require('../api-result');

module.exports = {
    handle: wrap(async (req, res, next) => {
        const type = req.body.type;
        const target = req.body.target;
        const nonce = req.body.ref;
        const signature = req.body.signature;
        const message = req.body.message;
        if (type !== 'anon' || target !== 'accept_connection') {
            return next(new APIResult(501, { message: 'Not yet implemented' }));
        }
        const connOffer = await ConnectionOffer.findOne({ nonce: nonce }).exec();
        if (!connOffer) {
            return next(new APIResult(404, { message: 'Unknown nonce' }));
        }
        req.wallet = await Wallet.findOne({ _id: connOffer.issuerWallet }).exec();
        await WalletProvider.provideHandle(req.wallet);
        const fromToKey = await indy.keyForDid(pool.handle, req.wallet.handle, connOffer.ownDid);
        const connRes = await req.wallet.anonDecryptAndVerify(fromToKey, message, signature);
        const role = connOffer.role === 'NONE' ? null : connOffer.role;
        await pool.nymRequest(req.wallet.handle, req.wallet.ownDid, connRes.did, connRes.verkey, null, role);
        await indy.storeTheirDid(req.wallet.handle, { did: connRes.did, verkey: connRes.verkey });
        await indy.createPairwise(req.wallet.handle, connRes.did, connOffer.ownDid);
        await connOffer.remove();
        next(new APIResult(200, { message: 'Success' }));
    })
};
