/**
 * IDChain Agent REST API Routes
 */

const router = require('express').Router();

const auth = require('../middleware/auth');
const walletProvider = require('../middleware/walletProvider');
const user = require('../controllers/user');
const wallet = require('../controllers/wallet');
const connection = require('../controllers/connection');
const schema = require('../controllers/credentialschema');
const creddef= require('../controllers/credentialdef');
const credential= require('../controllers/credential');
const credoffer= require('../controllers/credentialoffer');
const proof = require('../controllers/proof');

router.route('/user')
  // TODO rate-limiting?
  .post(user.create);

router.route('/endpoint')
  .post(connection.endpoint);

router.use(auth);
router.use(walletProvider.before);
router.param('wallet', walletProvider.param);

router.route('/user/:user')
  .get(user.retrieve)
  .put(user.update)
  .delete(user.delete);

router.route('/wallet')
  .get(wallet.list)
  .post(wallet.create);

router.route('/wallet/:wallet')
  .get(wallet.retrieve)
  .delete(wallet.delete);

router.route('/connectionoffer')
  .post(connection.create);

router.route('/connection')
  .post(connection.accept);

router.route('/schema')
  .get(schema.list)
  .post(schema.create);

router.route('/schema/:schema/')
  .get(schema.retrieve);

router.route('/credentialdef/')
  .get(creddef.list)
  .post(creddef.create);

router.route('/credentialdef/:credDefId/')
  .get(creddef.retrieve);

router.route('/credentialoffer/')
  .post(credoffer.create);

router.route('/credentialrequest/')
  .post(credoffer.accept);

router.route('/credentialissue/')
  .post(credential.issue);

router.route('/credential/')
  .post(credential.store)
  .get(credential.retrieveWithFilter);
router.route('/credential/:credId')
  .get(credential.retrieve);

router.route('/proofrequest')
  .post(proof.createProofRequest);
router.route('/proofrequest/:proofReq')
  .get(proof.getProofRequest);

router.route('/proof')
  .post(proof.createProof);

router.route('/proofverification')
  .post(proof.verifyProof);

router.use(walletProvider.after);

module.exports = router;
