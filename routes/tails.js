const router = require('express').Router();
const creddef = require('../controllers/credentialdef');

router.get('/:revocRegDefId/', creddef.retrieveTails);

module.exports = router;
