const fs = require('fs');
const YAML = require('js-yaml');
const Router = require('express').Router;
const SwaggerUI = require('swagger-ui-express');

module.exports = (docPath, swaggerOpts = { swaggerOptions: { docExpansion: 'none' } }, docEncoding = 'utf-8') => {
    const swaggerDoc = YAML.safeLoad(fs.readFileSync(docPath, docEncoding));
    const swaggerHtml = SwaggerUI.generateHTML(swaggerDoc, swaggerOpts);
    const router = Router();
    router.use('/', SwaggerUI.serveFiles(swaggerDoc, swaggerOpts));
    router.get('/', (req, res) => {
        res.send(swaggerHtml);
    });
    return { router, swaggerDoc };
};
