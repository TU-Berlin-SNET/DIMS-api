const router = require('express').Router();

const APIResult = require('../util/api-result');
const wrap = require('../util/asyncwrap').wrap;
const controller = require('../controllers/credentialdef');

router.get(
    '/:tailsHash',
    wrap(async (req, res, next) => {
        const data = await controller.retrieveTails(req.params.tailsHash);
        res.locals.result = new APIResult(200, data);
        next();
    })
);

module.exports = router;
