/**
 * IDChain Agent REST API Routes
 * Connection Request Routes
 */
'use strict';

const router = require('express').Router();
const controller = require('../../controllers/connection/index');
const wrap = require('../../util/asyncwrap').wrapNext;

router.route('/').post(
    wrap(async (req, res, next) => {
        const connection = await controller.createRequest(
            req.wallet,
            req.body.label,
            req.body.invitation,
            req.body.did
        );
        res.set('Location', '/api/connection/' + connection.id);
        return connection;
    })
);

module.exports = router;
