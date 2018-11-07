/**
 * IDCHain Agent REST API
 * Indy Low Level Schema Model
 */

const Mongoose = require('../db');
const Mixed = Mongoose.Schema.Types.Mixed;

const schema = new Mongoose.Schema(
    {
        _id: {
            type: String,
            required: true
        },
        parentSchemaId: {
            type: String,
            ref: 'Schema'
        },
        wallet: {
            type: String,
            ref: 'Wallet'
        },
        name: {
            type: String,
            required: true
        },
        version: {
            type: String,
            required: true
        },
        isRevocable: {
            type: Boolean,
            default: false
        },
        isDeprecated: {
            type: Boolean,
            default: false
        },
        lowLevelSchema: Mixed,
        credentialDefinitionId: {
            type: String
        },
        revocationRegistryId: {
            type: String
        },

        attributes: {
            type: Array,
            required: true,
            default: null
        }
    },
    { timestamps: true }
);

schema.set('toJSON', {
    versionKey: false,
    transform: (doc, ret, options) => {
        ret.schemaId = String(ret._id); // rename _id index to schemaId, as defined by swagger
        delete ret._id;
    }
});

module.exports = Mongoose.model('Schema', schema);
