/**
 * DID Auth Response Routes
 */
'use strict';

const router = require('express').Router();
const controller = require('../../controllers/did-auth/response');
const wrap = require('../../util/asyncwrap').wrap;
const APIResult = require('../../util/api-result');

router
    .route('/')
    .get(
        wrap(async (req, res, next) => {
            const data = await controller.list(req.wallet);
            res.locals.result = APIResult.success(data || []);
            next();
        })
    )
    .post(
        wrap(async (req, res, next) => {
            const data = await controller.create(req.wallet, req.body.request);
            res.locals.result = APIResult.created(data);
            next();
        })
    );

router
    .route('/:didauthresponseId')
    .get(
        wrap(async (req, res, next) => {
            const data = await controller.retrieve(req.wallet, req.params.didauthresponseId);
            res.locals.result = data ? APIResult.success(data) : APIResult.notFound();
            next();
        })
    )
    .delete(
        wrap(async (req, res, next) => {
            const data = await controller.remove(req.wallet, req.params.didauthresponseId);
            res.locals.result = data ? APIResult.noContent() : APIResult.notFound();
            next();
        })
    );

module.exports = router;
