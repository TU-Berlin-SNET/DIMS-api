const indy = require('indy-sdk');
const wrap = require('../asyncwrap').wrap;
const pool = require('../pool');
const APIResult = require('../api-result');

module.exports = {

  create: wrap(async (req, res, next) => {

  }),

  retrieve: wrap(async (req, res, next) => {
    // let parsedResponse = await module.exports.getCredential(req);
    // next(new APIResult(200, parsedResponse));
  }),


  getCredential: wrap(async (req) =>  {

  }),

  // Called by Issuer
  createCredential: wrap(async (req) => {

  }),

};
