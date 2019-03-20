'use strict';

const router = require('express').Router();
const controller = require('../controllers/credentialdef');
const wrap = require('../asyncwrap').wrap;
const APIResult = require('../api-result');

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
            const data = await controller.create(req.wallet, req.body);
            res.locals.result = APIResult.created(data);
            next();
        })
    );

router.route('/:credDefId').get(
    wrap(async (req, res, next) => {
        const data = await controller.retrieve(req.wallet, req.params.credDefId);
        res.locals.result = data ? APIResult.success(data) : APIResult.notFound('credential definition not found');
        next();
    })
);

module.exports = router;
