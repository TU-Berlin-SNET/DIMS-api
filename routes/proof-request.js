/**
 * IDChain Agent REST API Routes
 * Proof Request Routes
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
            const data = await controller.request.list(req.wallet);
            res.locals.result = APIResult.success(data);
            next();
        })
    )
    .post(
        wrap(async (req, res, next) => {
            const data = await controller.request.create(
                req.wallet,
                req.body.recipientDid,
                req.body.proofRequest,
                req.body.templateValues
            );
            res.locals.result = APIResult.created(data);
            next();
        })
    );

router
    .route('/:proofRequestId')
    .get(
        wrap(async (req, res, next) => {
            const data = await controller.request.retrieve(req.wallet, req.params.proofRequestId);
            res.locals.result = data ? APIResult.success(data) : APIResult.notFound();
            next();
        })
    )
    .delete(
        wrap(async (req, res, next) => {
            const data = await controller.request.remove(req.wallet, req.params.proofRequestId);
            res.locals.result = data ? APIResult.noContent() : APIResult.notFound();
            next();
        })
    );

module.exports = router;
