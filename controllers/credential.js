
const crypto = require('crypto');
const indy = require('indy-sdk');
const log = require('../log').log;
const wrap = require('../asyncwrap').wrap;
const pool = require('../pool');
const CredDef = require('./credentialdef');
const CredOffer = require('./credentialoffer');
const CredentialOffer = require('../models/credentialoffer');
const APIResult = require('../api-result');

module.exports = {

  // Called by Issuer
  create: wrap(async (req, res, next) => {
    log.debug('credential controller create');
    const cryptCredReq = req.body.encryptedCredentialRequest;
    //const cryptCredOfferId = req.body.encryptedCredentialOfferId;
    const [issuerHolderDid, issuerHolderKey, holderIssuerKey, credReqJson] = await req.wallet.tryAuthDecrypt(cryptCredReq);
    //const [, credOfferId] = await req.wallet.authDecrypt(issuerHolderKey, cryptCredOfferId);
    log.debug(credReqJson);
    const credOfferId = credReqJson['cred_offer_id']
    log.debug(credOfferId);

    let credOffer = await CredentialOffer.findById(credOfferId).exec();
    log.debug(credOffer);

    // Step 2: Create credential
    // (null values are for 1) revocation registry id and 2) blobStorageReaderHandle for reading revocation tails;
    // TODO support revocation features in the future)
    // credValues : { "firstname": {"raw: "Alice", "encoded": "valueAsInt"}, "lastname": {"raw": "Cooper", "encoded": "valueAsInt"}}
    let credValues = {};
    for (const key of Object.keys(req.body.values)) {
      const value = req.body.values[key];
      if (typeof value === 'number') {
        credValues[key] = {raw: value, encoded: value};
      } else {
        // const encodedValue = '' + parseInt(crypto.createHmac('sha256', value).digest('hex'), 16);
        const encodedValue = Buffer.from(crypto.createHmac('sha256', value).digest('hex'), 'utf-8').toString('hex');
        credValues[key] = {raw: value, encoded: encodedValue};
      }
    }
    log.debug('credValues ', credValues);

    await delete credReqJson['cred_offer_id'];
    log.debug(credOffer.data);
    log.debug(credReqJson);

    let [cred, credRevocId, revocRegDelta] = await indy.issuerCreateCredential(
      req.wallet.handle,
      credOffer.data,
      credReqJson,
      credValues,
      null, // FIXME provide revocRegId
      null
    );
    log.debug(cred);
    log.debug(credRevocId);
    log.debug(revocRegDelta);
    const cryptCred = await req.wallet.authCrypt(issuerHolderKey, holderIssuerKey, cred);

    next(new APIResult(201, {
      encryptedCredential: cryptCred,
    }));
  }),

  // Called by IDHolder
  retrieve: wrap(async (req, res, next) => {
    let credId = await module.exports.retrieveAndStoreCredential(req);
    next(new APIResult(200, credId));
  }),


  // Called by IDHolder
  retrieveAndStoreCredential: wrap(async (req) =>  {
    // ToDo Get Connection Did
    let holderIssuerKey = await indy.keyForLocalDid(req.wallet.handle,connectionDid);
    let [issuerHolderKey,credential] = await indy.cryptoAuthDecrypt(req.wallet.handle,holderIssuerKey,req.body.authCryptedMessage);
    // credId can be self-defined, if null then random credId is returned
    let credId = req.body.credId ? req.body.credId : null
    // revRegDef Revocation Registry Definiton is currently set to null, ToDo support revocation features in the future
    // ToDo Get CredentialDefinition
    // ToDo Get CredRequestMetadata
    //let [_,credDef] = CredDef.getCredDefFromLedger(req, req.body.credReqId);
    let credDef = CredDef.getCredDefFromLocal(req.body.credDefId);
    let credReqMetadata = req.body.credReqMetaData;
    credId = await indy.proverStoreCredential(req.wallet.handle,credId, credReqMetadata,credential, credDef, null)
    return credId;

  }),

  // Called by Issuer
  issueCredential: wrap(async (req) => {
    // ToDo Get Connection Did
    // Step 1 : Get VerKey for connection and use given authCrypted credential request and decrypt it
    let issuerHolderKey = await indy.keyForLocalDid(req.wallet.handle,req.body.issuerHolderDid);
    const decodedMessage = Buffer.from(req.body.authCryptedMessage, 'base64');
    let [holderIssuerKey, credReq] = await indy.cryptoAuthDecrypt(req.wallet.handle,issuerHolderKey, decodedMessage);
    const credReqJson = JSON.parse(credReq.toString('utf-8'));
    // Step 2: Create credential
    // (null values are for 1) revocation registry id and 2) blobStorageReaderHandle for reading revocation tails; ToDo support revocation features in the future)
    // credValues : { "firstname": {"raw: "Alice", "encoded": "valueAsInt"}, "lastname": {"raw": "Cooper", "encoded": "valueAsInt"}} ToDo check which encoding is required
    // ToDo get credOffer from DB - This step is not working.
    let credOffer = await CredOffer.getCredentialOffer(req);
    let [credential, credRevocId, revocRegDelta] = await indy.issuerCreateCredential(req.wallet.handle,credOffer,credReqJson,auth,req.body.credValues,null,null);
    let authCryptedCred = await indy.cryptoAuthCrypt(req.wallet.handle,issuerHolderKey,holderIssuerKey,credential);
    return [authCryptedCred,credRevocId,revocRegDelta];
  }),

};
