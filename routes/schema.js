/**
 * IDChain Agent REST API Routes
 * High-level Schema Routes
 */
'use strict';

const router = require('express').Router();
const controller = require('../controllers/schema');
const wrap = require('../asyncwrap').wrap;
const APIResult = require('../api-result');

router
    .route('/')
    .get(
        wrap(async (req, res, next) => {
            const data = await controller.list(req.wallet, req.query);
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
                req.body.parentSchemaId,
                req.body.attributes,
                req.body.createCredentialDefinition,
                req.body.isRevocable
            );
            res.locals.result = APIResult.created(data);
            next();
        })
    );

router
    .route('/:schemaId')
    .get(
        wrap(async (req, res, next) => {
            const data = await controller.retrieve(req.wallet, req.params.schemaId);
            res.locals.result = data ? APIResult.success(data) : APIResult.notFound();
            next();
        })
    )
    .patch(
        wrap(async (req, res, next) => {
            await controller.update(req.wallet, req.params.schemaId, req.body.operation);
            res.locals.result = APIResult.noContent();
            next();
        })
    );

router.use(['/', '/:schemaId'], (req, res, next) => {
    // FIXME eventually we should move away from misusing the
    // error handler and instead pass results through res.locals
    if (res.locals.result) {
        next(res.locals.result);
    } else {
        next();
    }
});

module.exports = router;
