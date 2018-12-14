/**
 * IDChain Agent REST API Routes
 * Wallet Routes
 */
'use strict';

const router = require('express').Router();
const controller = require('../controllers/wallet/index');
const wrap = require('../asyncwrap').wrap;
const APIResult = require('../api-result');

router
    .route('/')
    .get(
        wrap(async (req, res, next) => {
            const data = (await controller.wallet.list(req.user)).map(v => v.toMinObject());
            res.locals.result = APIResult.success(data || []);
            next();
        })
    )
    .post(
        wrap(async (req, res, next) => {
            const data = await controller.wallet.create(req.user, req.body.name, req.body.credentials, req.body.seed);
            res.locals.result = APIResult.created(data.toMinObject());
            next();
        })
    );

router
    .route('/:wallet')
    .get(
        wrap(async (req, res, next) => {
            const data = await controller.wallet.getPopulated(req.wallet);
            res.locals.result = APIResult.success(data);
            next();
        })
    )
    .delete(
        wrap(async (req, res, next) => {
            await req.wallet.remove();
            res.locals.result = APIResult.noContent();
            next();
        })
    );

router.route('/:wallet/connection').get(
    wrap(async (req, res, next) => {
        const data = await controller.connection.list(req.wallet);
        res.locals.result = APIResult.success(data || []);
        next();
    })
);

router.route('/:wallet/connection/:connectionId').get(
    wrap(async (req, res, next) => {
        const data = await controller.connection.retrieve(req.wallet, req.params.connectionId);
        res.locals.result = data ? APIResult.success(data) : APIResult.notFound();
        next();
    })
);

router.route('/:wallet/credential').get(
    wrap(async (req, res, next) => {
        const data = await controller.credential.list(req.wallet, req.query);
        res.locals.result = APIResult.success(data || []);
        next();
    })
);

router.route('/:wallet/credential/:credentialId').get(
    wrap(async (req, res, next) => {
        const data = await controller.credential.retrieve(req.wallet, req.params.credentialId);
        res.locals.result = data ? APIResult.success(data) : APIResult.notFound();
        next();
    })
);

module.exports = router;
