/**
 * Connection Offer Routes
 */
'use strict';

const router = require('express').Router();
const wrap = require('../../../util/asyncwrap').wrapNext;
// const controller = require('../../controllers/connection/index');
const controller = require('../../../controllers/connection/invitation');

module.exports = exports = { router };

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
                req.body.data,
                req.body.meta,
                req.body.role,
                req.body.label
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
