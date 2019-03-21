const router = require('express').Router();
const APIResult = require('../util/api-result');

router.get('/', (req, res, next) => {
    res.locals.result = APIResult.success({ healthy: true });
    next();
});

module.exports = router;
