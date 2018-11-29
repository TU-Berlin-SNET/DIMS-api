/**
 * IDChain Agent REST API Routes
 * Connection Offer Routes
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
            const data = await controller.offer.list(req.wallet);
            res.locals.result = APIResult.success(data || []);
            next();
        })
    )
    .post(
        wrap(async (req, res, next) => {
            const data = await controller.offer.create(
                req.wallet,
                req.body.data,
                req.body.meta,
                req.body.role,
                req.body.endpoint
            );
            res.locals.result = APIResult.created(data);
            next();
        })
    );

router
    .route('/:connectionOfferId')
    .get(
        wrap(async (req, res, next) => {
            const data = await controller.offer.retrieve(req.wallet, req.params.connectionOfferId);
            res.locals.result = data ? APIResult.success(data) : APIResult.notFound();
            next();
        })
    )
    .delete(
        wrap(async (req, res, next) => {
            const data = await controller.offer.remove(req.wallet, req.params.connectionOfferId);
            res.locals.result = data ? APIResult.noContent() : APIResult.notFound();
            next();
        })
    );

module.exports = router;
