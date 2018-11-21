/**
 * IDChain Agent REST API Routes
 * Credential Routes
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
            const data = await controller.credential.list(req.wallet);
            res.locals.result = APIResult.success(data);
            next();
        })
    )
    .post(
        wrap(async (req, res, next) => {
            const data = await controller.credential.create(req.wallet, req.body.credentialRequestId, req.body.values);
            res.locals.result = APIResult.created(data);
            next();
        })
    );

router.route('/:credentialId').get(
    wrap(async (req, res, next) => {
        const data = await controller.credential.retrieve(req.wallet, req.params.credentialId);
        res.locals.result = data ? APIResult.success(data) : APIResult.notFound();
        next();
    })
);

router.route('/:credentialId/revoke').post(
    wrap(async (req, res, next) => {
        const data = await controller.credential.revoke(req.wallet, req.params.credentialId);
        res.locals.result = data ? APIResult.success(data) : APIResult.notFound();
        next();
    })
);

router.use(['/', '/:credentialId', '/:credentialId/revoke'], (req, res, next) => {
    // FIXME eventually we should move away from misusing the
    // error handler and instead pass results through res.locals
    if (res.locals.result) {
        next(res.locals.result);
    } else {
        next();
    }
});

module.exports = router;
