const indy = require('indy-sdk');

// the file path where `tails` are created
// note that the content of tails is copied to local database, therefore these files can be cleaned
const tailsBaseDir = '/tmp/indy/tails';

const revocationType = 'CL_ACCUM';

module.exports = {
    tailsBaseDir,
    revocationType,
    /**
     * Open a blob storage writer
     * @param {Object} blobStorageConfig
     * @param {String} blobStorageType optional, uses 'default' if none provided
     * @return {Promise} resolves to a handle (number)
     */
    openBlobStorageWriter(blobStorageConfig, blobStorageType = 'default') {
        return indy.openBlobStorageWriter(blobStorageType, blobStorageConfig);
    },

    /**
     * Open a blob storage reader
     * @param {Object} blobStorageConfig
     * @param {String} blobStorageType optional, uses 'default' if none provided
     * @return {Promise} resolves to a handle (number)
     */
    openBlobStorageReader(blobStorageConfig, blobStorageType = 'default') {
        return indy.openBlobStorageReader(blobStorageType, blobStorageConfig);
    }
};
