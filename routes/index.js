const router = require('express').Router();

const middleware = require('../middleware/index');
const apiRouter = require('./api/index');
const agentRouter = require('./indy');
const tailsRouter = require('./tails');
const healthRouter = require('./health-check');

router.use(middleware.before);
router.use('/healthcheck', healthRouter);
router.use('/tails', tailsRouter);
router.use('/indy', agentRouter);
router.use('/api', apiRouter);
router.use(middleware.after);

module.exports = router;
