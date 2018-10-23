/**
 * IDChain Agent REST API Routes
 * Credential Offer Routes
 */
'use strict';

const router = require('express').Router();
const controller = require('../controllers/credential');
const wrap = require('../asyncwrap').wrap;
const APIResult = require('../api-result');

router
    .route('/')
    .get(
        wrap(async (req, res, next) => {
            const data = await controller.offer.list(req.wallet, req.query);
            res.locals.result = APIResult.success(data);
            next();
        })
    )
    .post(
        wrap(async (req, res, next) => {
            const data = await controller.offer.create(
                req.wallet,
                req.body.recipientDid,
                req.body.credDefId,
                req.body.credentialLocation
            );
            res.locals.result = APIResult.created(data);
            next();
        })
    );

router.route('/:credentialOfferId').get(
    wrap(async (req, res, next) => {
        const data = await controller.offer.retrieve(req.wallet, req.params.credentialOfferId);
        res.locals.result = data ? APIResult.success(data) : APIResult.notFound();
        next();
    })
);

router.use(['/', '/:credentialOfferId'], (req, res, next) => {
    // FIXME eventually we should move away from misusing the
    // error handler and instead pass results through res.locals
    if (res.locals.result) {
        next(res.locals.result);
    } else {
        next();
    }
});

module.exports = router;
