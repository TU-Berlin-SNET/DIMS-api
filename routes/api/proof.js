/**
 * IDChain Agent REST API Routes
 * Proof Routes
 */
'use strict';

const router = require('express').Router();
const controller = require('../../controllers/proof/index');
const wrap = require('../../util/asyncwrap').wrap;
const APIResult = require('../../util/api-result');

router
    .route('/')
    .get(
        wrap(async (req, res, next) => {
            const data = await controller.proof.list(req.wallet);
            res.locals.result = APIResult.success(data);
            next();
        })
    )
    .post(
        wrap(async (req, res, next) => {
            const data = await controller.proof.create(req.wallet, req.body.proofRequestId, req.body.values);
            res.locals.result = APIResult.created(data);
            next();
        })
    );

router
    .route('/:proofId')
    .get(
        wrap(async (req, res, next) => {
            const data = await controller.proof.retrieve(req.wallet, req.params.proofId);
            res.locals.result = data ? APIResult.success(data) : APIResult.notFound();
            next();
        })
    )
    .delete(
        wrap(async (req, res, next) => {
            const data = await controller.proof.remove(req.wallet, req.params.proofId);
            res.locals.result = data ? APIResult.noContent() : APIResult.notFound();
            next();
        })
    );

module.exports = router;
