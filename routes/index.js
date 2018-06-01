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
  .post(user.update)
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
  .post(creddef.create);

router.route('/credentialdef/:creddef/')
  .get(creddef.retrieve);

router.route('/credentialoffer/')
  .post(credoffer.create);

router.route('/credentialrequest/')
  .post(credoffer.accept);

router.route('/credential/')
  .post(credential.create);

router.route('/credential/:credential')
  .get(credential.retrieve);

router.use(walletProvider.after);

module.exports = router;
