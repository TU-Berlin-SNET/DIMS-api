/**
 * IDChain Agent REST API Routes
 * Connection Request Routes
 */
'use strict';

const router = require('express').Router();
const controller = require('../controllers/connection');
const wrap = require('../asyncwrap').wrap;
const APIResult = require('../api-result');

router
    .route('/')
    .get(
        wrap(async (req, res, next) => {
            const data = await controller.request.list(req.wallet);
            res.locals.result = APIResult.success(data || []);
            next();
        })
    )
    .post(
        wrap(async (req, res, next) => {
            const data = await controller.request.create(
                req.wallet,
                req.body.endpoint,
                req.body.theirDid,
                req.body.theirVk,
                req.body.theirEndpoint,
                req.body.connectionOffer
            );
            res.locals.result = APIResult.success(data);
            next();
        })
    );

router
    .route('/:connectionRequestId')
    .get(
        wrap(async (req, res, next) => {
            const data = await controller.request.retrieve(req.wallet, req.params.connectionRequestId);
            res.locals.result = data ? APIResult.success(data) : APIResult.notFound();
            next();
        })
    )
    .delete(
        wrap(async (req, res, next) => {
            const data = await controller.request.remove(req.wallet, req.params.connectionRequestId);
            res.locals.result = data ? APIResult.noContent() : APIResult.notFound();
            next();
        })
    );

module.exports = router;
