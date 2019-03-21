/**
 * IDChain Agent REST API
 * Transactions Controller
 */
const wrap = require('../util/asyncwrap').wrap;
const ledger = require('../lib').ledger;
const APIResult = require('../util/api-result');

module.exports = {
    list: wrap(async (req, res, next) => {
        const walletHandle = req.wallet.handle;
        const submitterDid = req.wallet.ownDid;
        const from = Number(req.query.from);
        const to = Number(req.query.to);
        const type = req.query.type || 'DOMAIN';
        const response = await ledger.getLedgerTransactions(walletHandle, submitterDid, from, to, type);
        next(new APIResult(200, response));
    })
};
