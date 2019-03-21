const router = require('express').Router();
const controller = require('../controllers/message');

router.post('/', controller.receiveMessage);

module.exports = router;
