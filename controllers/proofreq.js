const CredDef = require('./credentialdef');
const CredOffer = require('../models/credentialoffer');
const CredReq = require('../models/credentialreq');
const indy = require('indy-sdk');
const wrap = require('../asyncwrap').wrap;
const pool = require('../pool');
const log = require('../log').log;
const APIResult = require('../api-result');

module.exports = {

  // Called by Verifier
  create: wrap(async (req, res, next) => {

  }),

  //Called by IDHolder
  accept: wrap(async (req, res, next) => {

  }),

  // Called by Verifier
  createProofRequest: wrap(async (req) => {

  }),

  // Called by IDHolder after receiving the authCrypted ProofRequest off the Ledger from the Verifier and Creating a Proof to be returned to the Verifier
  acceptProofRequestAndProvideProof: wrap(async (req, res, next) =>  {

  }),



  getProofRequest: wrap(async (req) => {
    
  }),

};
