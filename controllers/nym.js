/**
 * IDChain Agent REST API
 * Nym Controller for sending and retrieving nym requests manually
 */

const pool = require('../pool');
const APIResult = require('../api-result');
const wrap = require('../asyncwrap').wrap;

module.exports = {
    getNym: wrap(async (req, res, next) => {
        const result = await pool.getNym(req.wallet.ownDid, req.params.did);
        result.result.data = JSON.parse(result.result.data);
        next(APIResult.success(result.result));
    }),

    sendNym: wrap(async (req, res, next) => {
        const result = await pool.nymRequest(
            req.wallet.handle,
            req.wallet.ownDid,
            req.body.did,
            req.body.verkey,
            req.body.alias,
            // 'NONE' actually means nothing so catch it
            // if 'NONE' is included in the request
            // indy-sdk returns CommonInvalidStructure
            req.body.role && req.body.role !== 'NONE' ? req.body.role : null
        );
        next(APIResult.success(result.result));
    })
};
