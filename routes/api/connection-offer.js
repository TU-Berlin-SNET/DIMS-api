/**
 * IDChain Agent REST API Routes
 * Connection Offer Routes
 */
'use strict';

const router = require('express').Router();
const wrap = require('../../util/asyncwrap').wrapNext;
const controller = require('../../controllers/connection');

module.exports = exports = { router };

router
    .route('/')
    .get(
        wrap(async (req, res, next) => {
            return controller.offer.list(req.wallet);
        })
    )
    .post(
        wrap(async (req, res, next) => {
            return controller.offer.create(req.wallet, req.body.data, req.body.meta, req.body.role, req.body.endpoint);
        })
    );

router
    .route('/:connectionOfferId')
    .get(
        wrap(async (req, res, next) => {
            return controller.offer.retrieve(req.wallet, req.params.connectionOfferId);
        })
    )
    .delete(
        wrap(async (req, res, next) => {
            return controller.offer.remove(req.wallet, req.params.connectionOfferId);
        })
    );
