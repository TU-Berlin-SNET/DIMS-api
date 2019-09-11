/**
 * Event Routes
 */
'use strict';

const router = require('express').Router();
const controller = require('../../../controllers/event');
const wrap = require('../../../util/asyncwrap').wrapNext;

router.route('/').get(
    wrap(async (req, res, next) => {
        return await controller.list(req.wallet, req.query);
    })
);

router
    .route('/:eventId')
    .get(
        wrap(async (req, res, next) => {
            return await controller.retrieve(req.wallet, req.params.eventId);
        })
    )
    .delete(
        wrap(async (req, res, next) => {
            return await controller.remove(req.wallet, req.params.eventId);
        })
    );

module.exports = router;
