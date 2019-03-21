const router = require('express').Router();
const swaggerUi = require('swagger-ui-express');

const swaggerDoc = require('../../swagger');

router.use('/', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

module.exports = router;
