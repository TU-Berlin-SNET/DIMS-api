const indy = require('indy-sdk');
const wrap = require('../asyncwrap').wrap;
const pool = require('../pool');
const CredDef = require('./credentialdef');
const CredOffer = require('./credentialoffer');
const APIResult = require('../api-result');

module.exports = {

  // Called by Issuer
  create: wrap(async (req, res, next) => {
    let [authCryptedCred, credRevocId, revocRegDelta] = await module.exports.issueCredential(req);
    next(new APIResult(201,authCryptedCred));
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
    let [holderIssuerKey, authDecryptedCredReq] = await indy.cryptoAuthDecrypt(req.wallet.handle,issuerHolderKey, req.body.authCryptedMessage);
    // Step 2: Create credential
    // (null values are for 1) revocation registry id and 2) blobStorageReaderHandle for reading revocation tails; ToDo support revocation features in the future)
    // credValues : { "firstname": {"raw: "Alice", "encoded": "valueAsInt"}, "lastname": {"raw": "Cooper", "encoded": "valueAsInt"}} ToDo check which encoding is required
    // ToDo get credOffer from DB
    let credOffer = await CredOffer.getCredentialOffer(req);
    let [credential, credRevocId, revocRegDelta] = await indy.issuerCreateCredential(req.wallet.handle,credOffer,authDecryptedCredReq,req.body.credValues,null,null);
    let authCryptedCred = await indy.cryptoAuthCrypt(req.wallet.handle,issuerHolderKey,holderIssuerKey,credential);
    return [authCryptedCred,credRevocId,revocRegDelta];
  }),

};
