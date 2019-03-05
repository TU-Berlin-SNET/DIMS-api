const Mongoose = require('../db');
const lib = require('../lib');

const IndySchema = Mongoose.model('IndySchema');

module.exports = {
    async list(wallet) {
        return IndySchema.find({
            wallet: wallet.id
        }).exec();
    },

    async create(wallet, user, name, version, attrNames) {
        const [schemaId, schema] = await lib.schema.create(wallet.handle, wallet.ownDid, name, version, attrNames);
        return new IndySchema({
            schemaId: schemaId,
            name: name,
            attrNames: attrNames,
            version: version,
            wallet: wallet.id,
            owner: user,
            data: schema
        }).save();
    },

    async retrieve(wallet, id) {
        const [, schema] = await lib.ledger.getSchema(wallet.ownDid, id);
        return schema;
    }
};
