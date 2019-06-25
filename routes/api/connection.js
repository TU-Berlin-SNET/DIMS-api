/**
 * IDChain Agent REST API Routes
 * Connection Routes
 */
'use strict';

const router = require('express').Router();
const wrap = require('../../util/asyncwrap').wrapNext;
const controller = require('../../controllers/connection/index');

router.route('/').get(
    wrap(async (req, res, next) => {
        return await controller.list(req.wallet, req.query);
    })
);

router
    .route('/:connectionId')
    .get(
        wrap(async (req, res, next) => {
            return await controller.retrieve(req.wallet, req.params.connectionId);
        })
    )
    .delete(
        wrap(async (req, res, next) => {
            return await controller.remove(req.wallet, req.params.connectionId);
        })
    );

module.exports = { router };
