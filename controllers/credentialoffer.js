const CredDef = require('./credentialdef');
const CredOffer = require('../models/credentialoffer');
const CredReq = require('../models/credentialreq');
const indy = require('indy-sdk');
const wrap = require('../asyncwrap').wrap;
const pool = require('../pool');
const log = require('../log').log;
const APIResult = require('../api-result');

module.exports = {

  // Called by Issuer
  create: wrap(async (req, res, next) => {
    const cryptedCredOffer = await module.exports.createCredentialOffer(req);
    const credOffer = new CredOffer({wallet:req.wallet.id, credDefId: req.body.credDefId, data: cryptedCredOffer.toString('base64'), owner:req.user})
    await credOffer.save();
    next(new APIResult(200, {encryptedCredOffer:credOffer.data}));
  }),

  //Called by IDHolder
  accept: wrap(async (req, res, next) => {
    const [cryptedCredReq,credReqMeta, credDefId] = await module.exports.acceptCredentialOfferAndCreateCredentialRequest(req);
    let credReq = new CredReq({wallet:req.wallet.id, credDefId: credDefId, credReqMetaData:credReqMeta, data: cryptedCredReq.toString('base64')});
    credReq = await credReq.save();
    next(new APIResult(200, {encryptedCredRequest:credReq.data}));
  }),

  // Called by Issuer
  createCredentialOffer: wrap(async (req) => {
    // Step1: Create CredOffer for IDHolder
    log.debug("credDefId", req.body.credDefId);
    const credOffer = await indy.issuerCreateCredentialOffer(req.wallet.handle,req.body.credDefId);
    log.debug(credOffer);
    const holderDid = req.body.holderDid;
    const pairwiseInfo = await indy.getPairwise(req.wallet.handle, holderDid);
    log.debug('pairwiseInfo', pairwiseInfo);
    const issuerHolderDid = pairwiseInfo['my_did'];
    // Step2: ToDo Get verKey between issuer and IDHolder (Get ConnectionDid from wallet)
    log.debug("holderIssuerDid:", holderDid);
    const holderIssuerVerKey = await indy.keyForDid(pool.handle,req.wallet.handle,holderDid);
    log.debug("holderIssuerKey:", holderIssuerVerKey);
    // Step3: ToDo Authcrypt CredentialOffer for IDHolder (Get Key between Issuer and IDHolder from Onboarding-Connection)
    log.debug("issuerHolderDid:", issuerHolderDid);
    const issuerHolderKey = await indy.keyForLocalDid(req.wallet.handle, issuerHolderDid);
    log.debug("issuerHolderKey:", issuerHolderKey);
    const bufferedCredOffer = Buffer.from(JSON.stringify(credOffer), 'utf-8');
    const cryptedCredOffer = await indy.cryptoAuthCrypt(req.wallet.handle,issuerHolderKey,holderIssuerVerKey,bufferedCredOffer);
    // Step4: Issuer sends IDHolder authCrypted Message outside of Ledger
    return cryptedCredOffer;
  }),

  // Called by IDHolder after receiving the authCrypted CredentialOffer off the Ledger from the Issuer and Creating a CredentialRequest to be returned to the Issuer
  acceptCredentialOfferAndCreateCredentialRequest: wrap(async (req, res, next) =>  {
    const [holderIssuerDid, holderIssuerKey, issuerHolderVerKey, credOfferJson] = await req.wallet
      .tryAuthDecrypt(req.body.authCryptedMessage);
    log.debug("Decrypted credOffer", credOfferJson);
    const masterSecret = req.body.masterSecret ? req.body.masterSecret : null;
    const masterSecretId = await indy.proverCreateMasterSecret(req.wallet.handle,masterSecret);
    // ToDo GetCredDef in the name of the holderIssuerDid (not the default issuerDid)
    const credDefIdFromCredOffer = credOfferJson['cred_def_id'];
    log.debug("credDefId from CredOffer", credDefIdFromCredOffer);
    const [credDefId, credDef] = await CredDef.getCredDefFromLedger(req, credDefIdFromCredOffer, holderIssuerDid);
    const credDefJson = JSON.stringify(credDef);

    log.debug("credDefLedger %s , credDef %s", credDefId, credDefJson);

    // ToDo Create Credential Request (Get ConnectionDid from wallet)
    const [credReq, credReqMeta] = await indy.proverCreateCredentialReq(req.wallet.handle,holderIssuerDid,credOfferJson,credDef,masterSecretId);

    // ToDo Get ConnectionDid from wallet
    const bufferCredReq = Buffer.from(JSON.stringify(credReq), 'utf-8');
    const authCryptedCredRequest = await indy.cryptoAuthCrypt(req.wallet.handle, holderIssuerKey, issuerHolderVerKey,bufferCredReq);
    return [authCryptedCredRequest, credReqMeta, credDefId];
  }),



  getCredentialOffer: wrap(async (req) => {
    const credOffer = await CredOffer.find({credDefId: req.body.credDefId});
    const recipientVK = await indy.keyForLocalDid(req.wallet.handle, req.body.did)
    const [senderVK,decryptedCredOffer] = await indy.cryptoAuthDecrypt(req.wallet.handle,recipientVK,credOffer['data']);
    return decryptedCredOffer;
  }),

};
