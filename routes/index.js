/**
 * IDChain Agent REST API Routes
 */

const bodyParser = require('body-parser');
const router = require('express').Router();

const auth = require('../middleware/auth');
const user = require('../controllers/user');
const wallet = require('../controllers/wallet');

router.use(bodyParser.json());

router.route('/users')
  // TODO rate-limiting?
  .post(user.create);

router.use(auth);

router.route('/users/:id')
  .get(user.retrieve)
  .post(user.update)
  .delete(user.delete);

router.route('/wallets')
  .get(wallet.list)
  .post(wallet.create);

router.route('/wallets/:id')
  .get(wallet.retrieve)
  .delete(wallet.delete);

module.exports = router;
