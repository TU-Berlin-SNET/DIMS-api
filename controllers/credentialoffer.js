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
    const pairwiseInfo = await indy.getPairwise(req.wallet.handle, req.body.holderIssuerDid);
    log.debug('pairwiseInfo', pairwiseInfo);
    const issuerHolderDid = pairwiseInfo['my_did'];
    // Step2: ToDo Get verKey between issuer and IDHolder (Get ConnectionDid from wallet)
    log.debug("holderIssuerDid:", req.body.holderIssuerDid);
    const holderIssuerVerKey = await indy.keyForDid(pool.handle,req.wallet.handle,req.body.holderIssuerDid);
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
    const decodedMessage = Buffer.from(req.body.authCryptedMessage, 'base64');
    const pairwises = await indy.listPairwise(req.wallet.handle);
    let holderIssuerDid;
    let holderIssuerKey;
    let issuerHolderVerKey;
    let credOffer;
    for (const pairwise of pairwises) {
      try {
        holderIssuerKey = await indy.keyForDid(pool.handle, req.wallet.handle, pairwise['my_did']);
        [issuerHolderVerKey, credOffer] = await indy.cryptoAuthDecrypt(req.wallet.handle, holderIssuerKey, decodedMessage);
        holderIssuerDid = pairwise['my_did'];
      } catch (err) {
        log.debug(err);
      }
    }
    if (!credOffer) {
      return next(new APIResult(400, {message: 'decryption failed, no fitting decryption key found'}));
    }
    const credOfferJson = JSON.parse(credOffer.toString('utf-8'));
    log.debug("Decrypted credOffer", credOfferJson);

    const masterSecret = req.body.masterSecret ? req.body.masterSecret : null;
    const masterSecretId = await indy.proverCreateMasterSecret(req.wallet.handle,masterSecret);
    // ToDo GetCredDef in the name of the holderIssuerDid (not the default issuerDid)
    const credDefIdFromCredOffer = credOfferJson['cred_def_id'];
    log.debug("credDefId from CredOffer", credDefIdFromCredOffer);
    const [credDefId, credDef] = await CredDef.getCredDefFromLedger(req, credDefIdFromCredOffer);
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
