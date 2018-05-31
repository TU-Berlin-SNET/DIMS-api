const CredDef = require('../controllers/credentialdef');
const CredOffer = require('../models/credentialoffer');
const indy = require('indy-sdk');
const wrap = require('../asyncwrap').wrap;
const pool = require('../pool');
const APIResult = require('../api-result');

module.exports = {

  create: wrap(async (req, res, next) => {
    let cryptedCredOffer = await module.exports.createCredentialOffer(req);
    let credOffer = new CredOffer({wallet:req.body.wallet, credDefId: req.body.credDefId, data: cryptedCredOffer})
    await credOffer.save();
    next(new APIResult(200, credOffer));
  }),

  retrieve: wrap(async (req, res, next) => {
    let parsedResponse = await module.exports.getCredentialOfferAndCreateCredentialRequest(req);
    next(new APIResult(200, parsedResponse));
  }),

  // Called by IDHolder after receiving the authCrypted CredentialOffer off the Ledger from the Issuer and Creating a CredentialRequest to be returned to the Issuer
  getCredentialOfferAndCreateCredentialRequest: wrap(async (req) =>  {
    let [issuerHolderVerKey, credOffer] = await module.exports.authDecrypt(req.wallet.handle,req.body.holderIssuerKey, req.body.authCryptedCredOffer)
    let masterSecret = req.body.masterSecret ? req.body.masterSecret : null;
    let masterSecretId = await indy.proverCreateMasterSecret(req.wallet.handle,masterSecret);
    let [credDefId, credDef] = await CredDef.getCredDefFromLedger(req, credOffer['cred_def_id']);
    // ToDo Create Credential Request (Get ConnectionDid from Wallet)
    let [credReq, credReqMeta] = await indy.proverCreateCredentialReq(req.wallet.handle,req.body.holderIssuerConnectionDid,credOffer,credDef,masterSecretId);
    // ToDo Get HolderIssuerVerificationKey from Wallet
    let authCryptedCredRequest = await indy.cryptoAuthCrypt(req.wallet.handle, req.holderIssuerVerKey, issuerHolderVerKey,credReq);
    return authCryptedCredRequest;
  }),

  // Called by Issuer
  createCredentialOffer: wrap(async (req) => {

    // Step1: Create CredOffer for IDHolder
        let credOffer = await indy.issuerCreateCredentialOffer(req.wallet.handle,req.body.credDefId)
    // Step2: ToDo Get verKey between issuer and IDHolder (Get ConnectionDid from Wallet)
        let holderIssuerVerKey = await indy.keyForDid(pool.handle,req.wallet.handle,req.body.issuerHolderConnectionDid)
    // Step3: ToDo Authcrypt CredentialOffer for IDHolder (Get Key between Issuer and IDHolder from Onboarding-Connection)
        let authCredOffer = await indy.cryptoAuthCrypt(req.wallet.handle,req.body.senderVerKey,holderIssuerVerKey,credOffer);
    // Step4: Issuer sends IDHolder authCrypted Message outside of Ledger
        return authCredOffer;
  }),

  authDecrypt: wrap(async(wh,key,message) => {
    let [fromVerkey, decryptedMessage] = await indy.cryptoAuthDecrypt(wh, key, message);
    return [fromVerkey,decryptedMessage];
  })
};
