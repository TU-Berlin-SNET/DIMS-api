const router = require('express').Router();
const nym = require('../controllers/nym');
const APIResult = require('../api-result');
const wrap = require('../asyncwrap').wrap;

router.post(
    '/',
    wrap(async (req, res, next) => {
        const data = await nym.post(req.wallet, req.body.did, req.body.verkey, req.body.alias, req.body.role);
        next(APIResult.success(data));
    })
);

router.get(
    '/:did',
    wrap(async (req, res, next) => {
        const data = await nym.get(req.wallet, req.params.did);
        next(APIResult.success(data));
    })
);

module.exports = router;
