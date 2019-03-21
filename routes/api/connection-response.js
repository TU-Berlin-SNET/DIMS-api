/**
 * IDChain Agent REST API Routes
 * Connection Response Routes
 */
'use strict';

const router = require('express').Router();
const controller = require('../../controllers/connection');
const wrap = require('../../util/asyncwrap').wrap;
const APIResult = require('../../util/api-result');

router.route('/').post(
    wrap(async (req, res, next) => {
        const data = await controller.response.create(req.wallet, req.body.connectionRequestId);
        res.locals.result = APIResult.success(data);
        next();
    })
);

module.exports = router;
