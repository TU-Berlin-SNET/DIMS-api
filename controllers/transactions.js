/**
 * IDChain Agent REST API
 * Transactions Controller
 */
const wrap = require('../asyncwrap').wrap;
const pool = require('../pool');
const APIResult = require('../api-result');

module.exports = {
    list: wrap(async (req, res, next) => {
        const walletHandle = req.wallet.handle;
        const submitterDid = req.wallet.ownDid;
        const from = Number(req.query.from);
        const to = Number(req.query.to);
        const type = req.query.type || 'DOMAIN';
        const response = await pool.getLedgerTransactions(walletHandle, submitterDid, from, to, type);
        next(new APIResult(200, response));
    })
};
