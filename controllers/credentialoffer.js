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
    // Step1: Create CredOffer for IDHolder
    log.debug('credDefId', req.body.credDefId);
    const holderDid = req.body.holderDid;
    const credOffer = await indy.issuerCreateCredentialOffer(req.wallet.handle, req.body.credDefId);
    log.debug(credOffer);

    // Step2: Get verKey between issuer and IDHolder
    const pairwiseInfo = await indy.getPairwise(req.wallet.handle, holderDid);
    log.debug('pairwiseInfo', pairwiseInfo);
    const issuerHolderDid = pairwiseInfo['my_did'];
    log.debug('holderIssuerDid:', holderDid);
    const holderIssuerVerKey = await indy.keyForDid(pool.handle, req.wallet.handle, holderDid);
    log.debug('holderIssuerKey:', holderIssuerVerKey);
    log.debug('issuerHolderDid:', issuerHolderDid);
    const issuerHolderKey = await indy.keyForLocalDid(req.wallet.handle, issuerHolderDid);
    log.debug('issuerHolderKey:', issuerHolderKey);

    // Step3: Authcrypt CredentialOffer for IDHolder (Get Key between Issuer and IDHolder from Onboarding-Connection)
    const cryptedCredOffer = await req.wallet.authCrypt(issuerHolderKey, holderIssuerVerKey, credOffer);

    // Step4: Issuer sends IDHolder authCrypted Message outside of Ledger
    let credentialOffer = new CredOffer({
      wallet: req.wallet,
      credDefId: req.body.credDefId,
      data: credOffer,
    });
    credentialOffer = await credentialOffer.save();
    const cryptedCredOfferId = await req.wallet.authCrypt(issuerHolderKey, holderIssuerVerKey, credentialOffer.id);
    next(new APIResult(200, {
      encryptedCredentialOfferId: cryptedCredOfferId,
      encryptedCredentialOffer: cryptedCredOffer,
    }));
  }),

  //Called by IDHolder
  accept: wrap(async (req, res, next) => {
    const [cryptedCredOfferId, cryptedCredReq, credReqMeta, credDefId] = await module.exports.acceptCredentialOfferAndCreateCredentialRequest(req);
    let credReq = new CredReq({wallet: req.wallet.id, credDefId: credDefId, credReqMetaData: credReqMeta, data: cryptedCredReq.toString('base64')});
    credReq = await credReq.save();
    next(new APIResult(200, {
      encryptedCredentialOfferId: cryptedCredOfferId,
      encryptedCredentialRequest: credReq.data,
    }));
  }),

  // Called by IDHolder after receiving the authCrypted CredentialOffer off the Ledger from the Issuer and Creating a CredentialRequest to be returned to the Issuer
  acceptCredentialOfferAndCreateCredentialRequest: wrap(async (req, res, next) => {
    const [holderIssuerDid, holderIssuerKey, issuerHolderVerKey, credOfferJson] = await req.wallet
      .tryAuthDecrypt(req.body.encryptedCredentialOffer);
    const [, credentialOfferId] = await req.wallet.authDecrypt(holderIssuerKey, req.body.encryptedCredentialOfferId);
    log.debug('Decrypted credOffer', credOfferJson);
    const masterSecret = req.body.masterSecret ? req.body.masterSecret : null;
    const masterSecretId = await indy.proverCreateMasterSecret(req.wallet.handle, masterSecret);

    // GetCredDef in the name of the holderIssuerDid (not the default issuerDid)
    const credDefIdFromCredOffer = credOfferJson['cred_def_id'];
    log.debug('credDefId from CredOffer', credDefIdFromCredOffer);
    const [credDefId, credDef] = await CredDef.getCredDefFromLedger(req, credDefIdFromCredOffer);
    const credDefJson = JSON.stringify(credDef);

    log.debug('credDefLedger %s , credDef %s', credDefId, credDefJson);

    // Create Credential Request (Get ConnectionDid from wallet)
    const [credReq, credReqMeta] = await indy.proverCreateCredentialReq(req.wallet.handle, holderIssuerDid, credOfferJson, credDef, masterSecretId);
    log.debug(credReq);
    log.debug(credReqMeta);

    // Get ConnectionDid from wallet
    const bufferCredReq = Buffer.from(JSON.stringify(credReq), 'utf-8');
    const authCryptedCredRequest = await indy.cryptoAuthCrypt(req.wallet.handle, holderIssuerKey, issuerHolderVerKey, bufferCredReq);
    const encryptedCredentialOfferId = await req.wallet.authCrypt(holderIssuerKey, issuerHolderVerKey, credentialOfferId);
    return [encryptedCredentialOfferId, authCryptedCredRequest, credReqMeta, credDefId];
  }),



  getCredentialOffer: wrap(async (req) => {
    const credOffer = await CredOffer.find({credDefId: req.body.credDefId});
    const recipientVK = await indy.keyForLocalDid(req.wallet.handle, req.body.did);
    const [senderVK, decryptedCredOffer] = await indy.cryptoAuthDecrypt(req.wallet.handle, recipientVK, credOffer['data']);
    return decryptedCredOffer;
  }),

};
