/**
 * IDChain Agent REST API Routes
 * Connection Request Routes
 */
'use strict';

const router = require('express').Router();
const controller = require('../../../controllers/connection/request');
const wrap = require('../../../util/asyncwrap').wrapNext;

router
    .route('/')
    .get(
        wrap(async (req, res, next) => {
            return await controller.list(req.wallet);
        })
    )
    .post(
        wrap(async (req, res, next) => {
            const connection = await controller.create(
                req.wallet,
                req.body.label,
                req.body.connectionOffer,
                req.body.did
            );
            return connection;
        })
    );

router
    .route('/:id')
    .get(
        wrap(async (req, res, next) => {
            return await controller.retrieve(req.wallet, req.params.id);
        })
    )
    .delete(
        wrap(async (req, res, next) => {
            return await controller.remove(req.wallet, req.params.id);
        })
    );

module.exports = router;
