/**
 * IDChain Agent REST API Routes
 * Connection Response Routes
 */
'use strict';

const router = require('express').Router();
const controller = require('../controllers/connection');
const wrap = require('../asyncwrap').wrap;
const APIResult = require('../api-result');

router.route('/').post(
    wrap(async (req, res, next) => {
        const data = await controller.response.create(req.wallet, req.body.connectionRequestId);
        res.locals.result = APIResult.success(data);
        next();
    })
);

router.use('/', (req, res, next) => {
    // FIXME eventually we should move away from misusing the
    // error handler and instead pass results through res.locals
    if (res.locals.result) {
        next(res.locals.result);
    } else {
        next();
    }
});

module.exports = router;
