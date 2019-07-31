const router = require('express').Router();

const middleware = require('../middleware/index');
const v1ApiRouter = require('./api/v1/index');
const v2ApiRouter = require('./api/v2/index');
const agentRouter = require('./indy');
const tailsRouter = require('./tails');
const healthRouter = require('./health-check');

router.use(middleware.before);
router.use('/healthcheck', healthRouter);
router.use('/tails', tailsRouter);
router.use('/indy', agentRouter);
router.use(/\/api(?!\/v1|\/v2)/, middleware.validation, v1ApiRouter);
router.use('/api/v1', middleware.validation, v1ApiRouter);
router.use('/api/v2', v2ApiRouter);
router.use(middleware.after);

module.exports = router;
