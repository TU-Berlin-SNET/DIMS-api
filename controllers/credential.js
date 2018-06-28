/**
 * IDChain Agent REST API
 * Credential Controller
 */

const crypto = require('crypto');
const indy = require('indy-sdk');
const log = require('../log').log;
const wrap = require('../asyncwrap').wrap;
const pool = require('../pool');
const CredentialDefinition = require('../models/credentialdef');
const CredentialOffer = require('../models/credentialoffer');
const CredentialRequest = require('../models/credentialreq');
const Credential = require('../models/credential');
const APIResult = require('../api-result');

/**
 * Encode a value as required by indy, i.e.
 * toString numbers and process strings.
 * @param {any} value value to encode
 * @return {string} encoded value
 */
function encode(value) {
  if (typeof value === 'number') {
    return value.toString();
  } else {
    return Buffer.from(crypto.createHmac('sha256', value).digest('hex'), 'utf-8').toString('hex');
  }
}

module.exports = {

  // Called by Issuer
  issue: wrap(async (req, res, next) => {
    const cryptCredReq = req.body.encryptedCredentialRequest;
    const [, issuerKey, holderKey, credReqJson] = await req.wallet.tryAuthDecrypt(cryptCredReq);
    const credOfferId = credReqJson['cred_offer_id'];
    delete credReqJson['cred_offer_id'];
    const credOffer = await CredentialOffer.findById(credOfferId).exec();
    const credDefDoc = await CredentialDefinition.findOne({credDefId: credOffer.credDefId});
    const isRevocable = typeof credDefDoc.revocRegId !== 'undefined'
      && typeof credDefDoc.revocRegType !== 'undefined';

    // Step 2: Create credential
    // credValues : { "firstname": {"raw: "Alice", "encoded": "valueAsInt"}, "lastname": {"raw": "Cooper", "encoded": "valueAsInt"}}
    let credValues = {};
    for (const key of Object.keys(req.body.values)) {
      const value = req.body.values[key];
      const encodedValue = encode(value);
      credValues[key] = {raw: value, encoded: encodedValue};
    }

    let params = [req.wallet.handle, credOffer.data, credReqJson, credValues];
    if (isRevocable) {
        params.push(credDefDoc.revocRegId);
        params.push(await pool.openBlobStorageReader());
    }
    const [cred, credRevocId, revocRegDelta] = await indy.issuerCreateCredential(...params);
    // TODO store credRevocId somewhere! needed for revocation later
    if (isRevocable) {
      await pool.revocRegEntryRequest(req.wallet.handle, req.wallet.ownDid,
        credDefDoc.revocRegId, credDefDoc.revocRegType, revocRegDelta);
    }
    cred['cred_offer_id'] = credOfferId;
    const cryptCred = await req.wallet.authCrypt(issuerKey, holderKey, cred);
    next(new APIResult(201, {
      encryptedCredential: cryptCred,
    }));
  }),

  // Called by IDHolder
  store: wrap(async (req, res, next) => {
    // credId can be self-defined, if null then random credId is returned
    const [holderDid, holderVk, issuerVerKey, credential] = await req.wallet.tryAuthDecrypt(req.body.encryptedCredential);
    let credId = req.body.credId || null;

    const credOfferId = credential['cred_offer_id'];
    const credReq = await CredentialRequest.findOne({credOfferId: credOfferId});
    const credReqMetadata = credReq.credReqMetaData;
    const masterSecretName = credReqMetadata['master_secret_name'];
    const revocRegId = credential['rev_reg_id'] || null;
    const [credDefId, credDef] = await pool.getCredDef(holderDid, credential['cred_def_id']);

    let params = [req.wallet.handle, credId, credReqMetadata, credential, credDef];
    if (revocRegId) {
      const [revocRegDefId, revocRegDef] = await pool.getRevocRegDef(req.wallet.ownDid, revocRegId);
      params.push(revocRegDef);
    }
    credId = await indy.proverStoreCredential(...params);
    const cred = await new Credential({
      credId: credId,
      data: credential,
      masterSecretName: masterSecretName,
      wallet: req.wallet.id,
    }).save();
    next(new APIResult(200, {credentialId: credId}));
  }),

  retrieve: wrap(async(req,res,next)=> {
    const cred = await Credential.findOne({credId:req.params.credId})
    next(new APIResult(200, cred))
  }),

  retrieveWithFilter: wrap(async(req,res,next)=> {
    let filter;
    if(req.params.schema) filter.schema_id = req.params.schema;
    if(req.params.schemaIssuerDid) filter.schema_issuer_did = req.params.schemaIssuerDid;
    if(req.params.schemaName) filter.schema_name = req.params.schemaName;
    if(req.params.schemaVersion) filter.schema_version = req.params.schemaVersion;
    if(req.params.issuerDid) filter.issuer_did = req.params.issuerDid;
    if(req.params.credDefId) filter.cred_def_did = req.params.credDefId;

    const credentials = await indy.proverGetCredentials(req.wallet.handle, filter);
  }),

  // Called by IDHolder
  storeCredential: wrap(async (req) =>  {
    let [holderDid, holderVk, issuerVerKey, credential] = await req.wallet.tryAuthDecrypt(req.body.encryptedCredential);

    // credId can be self-defined, if null then random credId is returned
    let credId = req.body.credId ? req.body.credId : null

    // revRegDef Revocation Registry Definiton is currently set to null, ToDo support revocation features in the future
    const credOfferId = credential['cred_offer_id'];
    const credReq = await CredentialRequest.findOne({credOfferId: credOfferId});
    const credReqMetadata = credReq.credReqMetaData;

    let [credDefId, credDef] = await pool.getCredDef(holderDid, credential['cred_def_id']);
    credId = await indy.proverStoreCredential(req.wallet.handle,credId, credReqMetadata,credential, credDef, null)
    return [credId, credential, credReq.credReqMetaData.master_secret_name];
  }),


};
