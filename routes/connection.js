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
        if (data) {
            res.locals.result = APIResult.success({
                myDid: data['my_did'],
                theirDid: data['their_did'],
                acknowledged: data.metadata.acknowledged
            });
        } else {
            res.locals.result = APIResult.notFound('no matching connection found');
        }
        next();
    })
);

module.exports = router;
