const sdk = require('indy-sdk');

/**
 * Indy Blobstorage reader/writer encapsulation
 */
class BlobStorage {
    /**
     * @param {object} config blobStorageConfig
     * @param {string} [type]
     */
    constructor(config, type = 'default') {
        this.config = config;
        this.type = type;
        this.reader = -1;
        this.writer = -1;
    }

    /**
     * @param {object} config blobStorageConfig
     * @param {string} [type]
     */
    setup(config, type = 'default') {
        this.config = config;
        this.type = type;
        this.reader = -1;
        this.writer = -1;
    }

    /**
     * Open blob storage
     * @return {Promise<BlobStorage>} this
     */
    async open() {
        if (this.reader !== -1 && this.writer !== -1) {
            throw new Error('blobstorage already opened');
        }
        this.reader = await sdk.openBlobStorageReader(this.type, this.config);
        this.writer = await sdk.openBlobStorageWriter(this.type, this.config);
        return this;
    }
}

module.exports = new BlobStorage();
module.exports.class = BlobStorage;
