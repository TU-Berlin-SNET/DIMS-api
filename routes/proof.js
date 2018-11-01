/**
 * IDChain Agent REST API Routes
 * Proof Routes
 */
'use strict';

const router = require('express').Router();
const controller = require('../controllers/proof/index');
const wrap = require('../asyncwrap').wrap;
const APIResult = require('../api-result');

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

router.use(['/', '/:proofId'], (req, res, next) => {
    // FIXME eventually we should move away from misusing the
    // error handler and instead pass results through res.locals
    if (res.locals.result) {
        next(res.locals.result);
    } else {
        next();
    }
});

module.exports = router;
