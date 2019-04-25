const router = require('express').Router();
const wrap = require('../util/asyncwrap').wrapNext;
const controller = require('../controllers/message');

router.post(
    '/',
    wrap(async (req, res, next) => {
        return await controller.receiveMessage(req.body.message);
    })
);

module.exports = router;
