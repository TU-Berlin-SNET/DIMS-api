/**
 * Connection Invitation Routes
 */
'use strict';

const router = require('express').Router();
const wrap = require('../../util/asyncwrap').wrapNext;
const controller = require('../../controllers/connection/index');

module.exports = exports = { router };

router.route('/').post(
    wrap(async (req, res, next) => {
        const connection = await controller.createInvitation(
            req.wallet,
            req.body.data,
            req.body.meta,
            req.body.role,
            req.body.label
        );
        res.set('Location', '/api/connection/' + connection.id);
        return connection;
    })
);
