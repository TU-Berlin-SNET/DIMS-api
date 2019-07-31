const router = require('express').Router();
const log = require('../../../log');
const docs = require('./docs');

router.use('/docs', docs.router);

module.exports = router;
