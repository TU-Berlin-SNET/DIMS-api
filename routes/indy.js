const router = require('express').Router();
const wrap = require('../util/asyncwrap').wrapNext;
const controller = require('../controllers/http-transport');

router.post('/', wrap(controller.receive));

module.exports = router;
