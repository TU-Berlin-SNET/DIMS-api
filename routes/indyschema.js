const router = require('./index');

const schema = require('../controllers/indyschema')

router.route('/schema')
  .get(schema.read)
  .post();

router.route('/schema/:id')
  .get();

