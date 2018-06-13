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
    // Step1: Create CredOffer for IDHolder ToDo still not clear where Issuer gets the correct did from holder
    const holderDid = req.body.holderDid;
    let credOffer = await indy.issuerCreateCredentialOffer(req.wallet.handle, req.body.credDefId);

    // Step2: Get verKey between issuer and IDHolder
    const pairwiseInfo = await indy.getPairwise(req.wallet.handle, holderDid);
    const issuerDid = pairwiseInfo['my_did'];
    const holderVerKey = await indy.keyForDid(pool.handle, req.wallet.handle, holderDid);
    const issuerKey = await indy.keyForLocalDid(req.wallet.handle, issuerDid);

    // Step3: Issuer sends IDHolder authCrypted Message outside of Ledger
    let credentialOffer = new CredOffer({
      wallet: req.wallet,
      credDefId: req.body.credDefId,
      data: credOffer,
    });
    credentialOffer = await credentialOffer.save();
    credOffer['cred_offer_id'] = credentialOffer.id;
    const cryptedCredOffer = await req.wallet.authCrypt(issuerKey, holderVerKey, credOffer);
      next(new APIResult(200, {
      encryptedCredentialOffer: cryptedCredOffer,
    }));
  }),

  //Called by IDHolder
  accept: wrap(async (req, res, next) => {
    const [cryptedCredReq, credReqMeta, credDefId, credOfferId] = await module.exports.acceptCredentialOfferAndCreateCredentialRequest(req);
    let credReq = new CredReq({wallet: req.wallet.id, credDefId: credDefId, credOfferId: credOfferId,credReqMetaData: credReqMeta, data: cryptedCredReq.toString('base64')});
    credReq = await credReq.save();
    next(new APIResult(200, {
      encryptedCredentialRequest: credReq.data,
    }));
  }),

  // Called by IDHolder after receiving the authCrypted CredentialOffer off the Ledger from the Issuer and Creating a CredentialRequest to be returned to the Issuer
  acceptCredentialOfferAndCreateCredentialRequest: wrap(async (req, res, next) => {
    const [holderDid, holderKey, issuerVerKey, credOfferJson] = await req.wallet
      .tryAuthDecrypt(req.body.encryptedCredentialOffer);
    const masterSecret = req.body.masterSecret ? req.body.masterSecret : null;
    const masterSecretId = await indy.proverCreateMasterSecret(req.wallet.handle, masterSecret);

    // GetCredDef in the name of the holderIssuerDid (not the default issuerDid)
    const credDefIdFromCredOffer = credOfferJson['cred_def_id'];
    const [credDefId, credDef] = await CredDef.getCredDefFromLedger(holderDid, credDefIdFromCredOffer);
    const credDefJson = JSON.stringify(credDef);

    // Create Credential Request
    const [credReq, credReqMeta] = await indy.proverCreateCredentialReq(req.wallet.handle, holderDid, credOfferJson, credDef, masterSecretId);
    const credOfferId = credOfferJson['cred_offer_id'];
    credReq['cred_offer_id']= credOfferId;
    const bufferCredReq = Buffer.from(JSON.stringify(credReq), 'utf-8');
    const authCryptedCredRequest = await indy.cryptoAuthCrypt(req.wallet.handle, holderKey, issuerVerKey, bufferCredReq);
    return [authCryptedCredRequest, credReqMeta, credDefId, credOfferId];
  }),


  getCredentialOffer: wrap(async (req) => {
    const credOffer = await CredOffer.find({credDefId: req.body.credDefId});
    const recipientVK = await indy.keyForLocalDid(req.wallet.handle, req.body.did);
    const [senderVK, decryptedCredOffer] = await indy.cryptoAuthDecrypt(req.wallet.handle, recipientVK, credOffer['data']);
    return decryptedCredOffer;
  }),

};
