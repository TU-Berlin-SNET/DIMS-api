/**
 * IDChain Agent REST API Routes
 */

const router = require('express').Router();

const auth = require('../middleware/auth');
const walletProvider = require('../middleware/walletProvider');
const user = require('../controllers/user');
const wallet = require('../controllers/wallet');
const connection = require('../controllers/connection');

router.route('/users')
  // TODO rate-limiting?
  .post(user.create);

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

router.use(walletProvider.after);

module.exports = router;
