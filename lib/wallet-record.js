const sdk = require('indy-sdk');

const types = {
    connection: 'connection',
    config: 'config'
};

const ids = {
    endpointDid: 'endpointDid',
    masterSecretId: 'masterSecretId'
};

module.exports = {
    types,
    ids,

    /**
     * Add a record to the wallet
     * @param {Wallet} wallet
     * @param {string} type
     * @param {string} id
     * @param {object} data
     * @param {object} [tags]
     * @return {Promise<void>} resolves when stored or error
     */
    async add(wallet, type, id, data, tags) {
        return sdk.addWalletRecord(wallet.handle, type, id, JSON.stringify(data), tags);
    },

    /**
     * Retrieve a record from the wallet and JSON.parse()
     * @param {Wallet} wallet
     * @param {string} type
     * @param {string} id
     * @param {object} [options]
     * @return {Promise<object>} wallet record
     */
    async retrieve(wallet, type, id, options = {}) {
        let record = await sdk.getWalletRecord(wallet.handle, type, id, options);
        if (record) {
            record.value = JSON.parse(record.value);
        }
        return record.value;
    },

    /**
     * Try to retrieve a record
     * Catches IndyError 212 (Not Found) and returns null instead
     * @param {Wallet} wallet
     * @param {string} type
     * @param {string} id
     * @param {object} [options]
     * @return {Promise<object>} wallet record or null
     */
    async tryRetrieve(wallet, type, id, options = {}) {
        let record = null;
        try {
            record = (await sdk.getWalletRecord(wallet.handle, type, id, options)).value;
        } catch (err) {
            // if it is not an indy error with error code 212 (item not found)
            // then throw the error
            if (!err.indyCode || err.indyCode !== 212) {
                throw err;
            }
        }
        return record;
    },

    /**
     * Update a record in the wallet
     * @param {Wallet} wallet
     * @param {string} type
     * @param {string} id
     * @param {object} [data]
     * @param {object} [tags]
     * @return {Promise<void>} resolves when stored or error
     */
    async update(wallet, type, id, data, tags) {
        if (data) {
            await sdk.updateWalletRecordValue(wallet.handle, type, id, JSON.stringify(data));
        }
        if (tags) {
            await sdk.updateWalletRecordTags(wallet.handle, type, id, tags);
        }
    },

    /**
     * Delete a record from the wallet
     * @param {Wallet} wallet
     * @param {string} type
     * @param {string} id
     * @return {Promise<void>} resolves when deleted or error
     */
    async remove(wallet, type, id) {
        return await sdk.deleteWalletRecord(wallet.handle, type, id);
    }
};
