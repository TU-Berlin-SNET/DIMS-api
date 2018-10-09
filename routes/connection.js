/**
 * IDChain Agent REST API Routes
 * Connection Routes
 */
'use strict';

const router = require('express').Router();
const controller = require('../controllers/connection');
const wrap = require('../asyncwrap').wrap;
const APIResult = require('../api-result');

router.route('/:myDid').get(
    wrap(async (req, res, next) => {
        const data = await controller.retrieve(req.wallet, req.params.myDid);
        res.locals.result = data ? APIResult.success(data) : APIResult.notFound();
        next(res.locals.result);
    })
);

module.exports = router;
