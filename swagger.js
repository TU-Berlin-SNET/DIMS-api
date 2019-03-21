const YAML = require('yamljs');
const swaggerDoc = YAML.load('./swagger.yaml');

module.exports = swaggerDoc;
