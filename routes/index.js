/**
 * IDChain Agent REST API Routes
 */

const router = require('express').Router();

const auth = require('../middleware/auth');
const walletProvider = require('../middleware/walletProvider');
const user = require('../controllers/user');
const wallet = require('../controllers/wallet');
const connection = require('../controllers/connection');
const schema = require('../controllers/indyschema');
const creddef= require('../controllers/credentialdef');
const credential= require('../controllers/credential');

router.route('/users')
  // TODO rate-limiting?
  .post(user.create);

router.route('/endpoint')
  .post(connection.endpoint);

router.use(auth);
router.use(walletProvider.before);
router.param('wallet', walletProvider.param);

router.route('/users/:user')
  .get(user.retrieve)
  .post(user.update)
  .delete(user.delete);

router.route('/wallets')
  .get(wallet.list)
  .post(wallet.create);

router.route('/wallets/:wallet')
  .get(wallet.retrieve)
  .delete(wallet.delete);

router.route('/connectionoffers')
  .post(connection.create);

router.route('/connections')
  .post(connection.accept);

router.route('/schemas')
  .get(schema.list)
  .post(schema.create);

router.route('/schemas/:schema/:wallet')
  .get(schema.retrieve);

router.route('/credentialdefs/')
  .post(creddef.create);

router.route('/credentialdefs/:credreq/:wallet')
  .get(creddef.retrieve);

router.route('/credentials/')
  .post(credential.create);

router.route('/credentials/:credential')
  .get(credential.retrieve);

router.use(walletProvider.after);

module.exports = router;
