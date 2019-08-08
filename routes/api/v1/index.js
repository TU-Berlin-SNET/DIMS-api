/**
 * IDChain Agent REST API Routes
 */

const router = require('express').Router();

const auth = require('../../../middleware/auth');
const walletProvider = require('../../../middleware/walletProvider');
const user = require('../../../controllers/user');
const transactions = require('../../../controllers/transactions');
const schemaController = require('../../../controllers/schema');
const nym = require('./nym');

const docs = require('./docs');
const wallet = require('./wallet');
const connectionOffer = require('./connection-offer');
const connectionRequest = require('./connection-request');
const connection = require('./connection');
const indySchema = require('./indy-schema');
const schema = require('./schema');
const credentialDefinition = require('./credential-definition');
const credentialProposal = require('./credential-proposal');
const credentialOffer = require('./credential-offer');
const credentialRequest = require('./credential-request');
const credential = require('./credential');
const proofRequestTemplate = require('./proof-request-template');
const proofRequest = require('./proof-request');
const proof = require('./proof');

router.use('/docs', docs.router);

router.route('/user').post(user.create);

router.post('/login', auth.login);

router.use(auth);
router.use(walletProvider.before);

router
    .route('/user/:user')
    .get(user.retrieve)
    .put(user.update)
    .delete(user.delete);

router.use('/wallet', wallet);

router.use('/connectionoffer', connectionOffer.router);

router.use('/connectionrequest', connectionRequest);

router.use('/connection', connection.router);

router.use('/indyschema', indySchema);

router.use('/schema', schema);
router.route('/attribute/type').get(schemaController.types); // it does not need auth middleware, but I keep it here to be treated the same as schemas

router.use('/credentialproposal', credentialProposal);

router.use('/credentialoffer', credentialOffer);

router.use('/credentialrequest', credentialRequest);

router.use('/credential', credential);

router.use('/credentialdef', credentialDefinition);

router.use('/proofrequesttemplate', proofRequestTemplate);

router.use('/proofrequest', proofRequest);

router.use('/proof', proof);

router.route('/transactions').get(transactions.list);

router.use('/nym', nym);

router.use(walletProvider.after);

module.exports = router;
