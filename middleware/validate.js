/**
 * IDChain Agent REST API
 * Validation Middleware
 */
'use strict';

const ajv = require('ajv')({ removeAdditional: true });
const log = require('../log');
const APIResult = require('../util/api-result');
const swaggerDoc = require('../routes/api/v1/docs').swaggerDoc;

ajv.addSchema(swaggerDoc, 'swagger.json');
const rx = /^\/(api|api\/v1)\/(\w+)$/;

/**
 * Validation Middleware
 * Checks if a schema with ref '#/definitions/path_method exists
 * and applies it if it does
 * @param {object} req expressjs object
 * @param {object} res expressjs object
 * @param {function} next expressjs callback function
 */
async function middleware(req, res, next) {
    const url = req.originalUrl;
    const match = rx.exec(url);
    const vName = match && match.length >= 3 ? `${match[2]}_${req.method.toLowerCase()}` : null;
    const validate = vName ? ajv.getSchema(`swagger.json#/definitions/${vName}`) : null;
    const valid = validate ? validate(req.body) : true;
    log.debug('Validation Middleware evaluated %j', { url, match, vName, valid });
    if (!valid) {
        next(new APIResult(400, { message: ajv.errorsText(validate.errors) }));
    } else {
        next();
    }
}

module.exports = middleware;
