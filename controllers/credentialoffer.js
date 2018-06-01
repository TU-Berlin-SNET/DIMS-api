const CredDef = require('../controllers/credentialdef');
const CredOffer = require('../models/credentialoffer');
const indy = require('indy-sdk');
const wrap = require('../asyncwrap').wrap;
const pool = require('../pool');
const APIResult = require('../api-result');

module.exports = {

  // Called by Issuer
  create: wrap(async (req, res, next) => {
    let cryptedCredOffer = await module.exports.createCredentialOffer(req);
    let credOffer = new CredOffer({wallet:req.body.wallet, credDefId: req.body.credDefId, data: cryptedCredOffer})
    await credOffer.save();
    next(new APIResult(200, credOffer));
  }),

  //Called by IDHolder
  retrieve: wrap(async (req, res, next) => {
    let [credReqMeta,cryptedCredReq] = await module.exports.retrieveCredentialOfferAndCreateCredentialRequest(req);
    next(new APIResult(200, [credReqMeta,cryptedCredReq]));
  }),

  // Called by IDHolder after receiving the authCrypted CredentialOffer off the Ledger from the Issuer and Creating a CredentialRequest to be returned to the Issuer
  retrieveCredentialOfferAndCreateCredentialRequest: wrap(async (req) =>  {
    let holderIssuerKey = indy.keyForLocalDid(req.wallet.handle, req.body.holderIssuerDid);
    let [issuerHolderVerKey, credOffer] = await indy.cryptoAuthDecrypt(req.wallet.handle,holderIssuerKey, req.body.authCryptedMessage)
    let masterSecret = req.body.masterSecret ? req.body.masterSecret : null;
    let masterSecretId = await indy.proverCreateMasterSecret(req.wallet.handle,masterSecret);
    let [credDefId, credDef] = await CredDef.getCredDefFromLedger(req, credOffer['cred_def_id']);
    // ToDo Create Credential Request (Get ConnectionDid from Wallet)
    let [credReq, credReqMeta] = await indy.proverCreateCredentialReq(req.wallet.handle,req.body.holderIssuerConnectionDid,credOffer,credDef,masterSecretId);
    // ToDo Get ConnectionDid from Wallet
    //let holderIssuerKey = await indy.keyForLocalDid(req.wallet.handle,connectionDid);
    let authCryptedCredRequest = await indy.cryptoAuthCrypt(req.wallet.handle, holderIssuerKey, issuerHolderVerKey,credReq);
    return [credReqMeta,authCryptedCredRequest];
  }),

  // Called by Issuer
  createCredentialOffer: wrap(async (req) => {

    // Step1: Create CredOffer for IDHolder
        let credOffer = await indy.issuerCreateCredentialOffer(req.wallet.handle,req.body.credDefId)
    // Step2: ToDo Get verKey between issuer and IDHolder (Get ConnectionDid from Wallet)
        let holderIssuerVerKey = await indy.keyForDid(pool.handle,req.wallet.handle,req.body.issuerHolderDid);
    // Step3: ToDo Authcrypt CredentialOffer for IDHolder (Get Key between Issuer and IDHolder from Onboarding-Connection)
        let issuerHolderKey = await indy.keyForLocalDid(req.wallet.handle, req.body.issuerHolderDid);
        let authCredOffer = await indy.cryptoAuthCrypt(req.wallet.handle,issuerHolderKey,holderIssuerVerKey,credOffer);
    // Step4: Issuer sends IDHolder authCrypted Message outside of Ledger
        return authCredOffer;
  }),

  getCredentialOffer: wrap(async (req) => {
    let credOffer = await CredOffer.find({credRefId: req.body.credRefId});
    let recipientVK = await indy.keyForLocalDid(req.wallet.handle, req.body.did)
    let [senderVK,decryptedCredOffer] = await indy.cryptoAuthDecrypt(req.wallet.handle,recipientVK,credOffer['data']);
    return decryptedCredOffer;
  }),

};
