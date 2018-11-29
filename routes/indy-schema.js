/**
 * IDChain Agent REST API Routes
 * Indy Schema Routes
 */
'use strict';

const router = require('express').Router();
const controller = require('../controllers/indy-schema');
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
            const data = await controller.create(
                req.wallet,
                req.user,
                req.body.name,
                req.body.version,
                req.body.attrNames
            );
            res.locals.result = APIResult.created(data);
            next();
        })
    );

router.route('/:schemaId').get(
    wrap(async (req, res, next) => {
        const data = await controller.retrieve(req.wallet, req.params.schemaId);
        res.locals.result = data ? APIResult.success(data) : APIResult.notFound();
        next();
    })
);

module.exports = router;
