const sdk = require('indy-sdk');
const log = require('./log');

/**
 * Check if error is wallet not found error
 * @param {object} err
 * @return {boolean}
 */
function isWalletNotFoundError(err) {
    return err.name === 'IndyError' && err.message === '212';
}

module.exports = exports = {};

/**
 * Find record values of type which match query in wallet
 * @param {Wallet} wallet
 * @param {string} type
 * @param {object} query
 * @return {object[]} values
 */
exports.find = async (wallet, type, query) => {
    const options = { retrieveRecords: true, retrieveTotalCount: true };
    const searchHandle = await sdk.openWalletSearch(wallet.handle, type, query, options);
    try {
        // retrieve one record first to get total number of available records
        const data = await sdk.fetchWalletSearchNextRecords(wallet.handle, searchHandle, 1);
        // if there are zero or one records, return
        if (!data.records || data.totalCount === 1) {
            return data.records ? [JSON.parse(data.records[0].value)] : [];
        }
        // else retrieve all other records
        const moreData = await sdk.fetchWalletSearchNextRecords(wallet.handle, searchHandle, data.totalCount);
        const records = [data.records[0], ...moreData.records];
        return records.map(v => JSON.parse(v.value));
    } catch (err) {
        log.warn(err);
        if (!isWalletNotFoundError(err)) {
            throw err;
        }
    } finally {
        await sdk.closeWalletSearch(searchHandle);
    }
    return [];
};

/**
 * @param {Wallet} wallet
 * @param {string} type
 * @param {object} query
 * @param {object} [options]
 * @return {Promise<object>} value
 */
exports.findOne = async (wallet, type, query, options = {}) => {
    const searchHandle = await sdk.openWalletSearch(wallet.handle, type, query, options);
    try {
        const data = await sdk.fetchWalletSearchNextRecords(wallet.handle, searchHandle, 1);
        if (data.records) {
            return JSON.parse(data.records[0].value);
        }
    } catch (err) {
        log.warn(err);
        if (!isWalletNotFoundError(err)) {
            throw err;
        }
    } finally {
        await sdk.closeWalletSearch(searchHandle);
    }
    return;
};

/**
 * Retrieve a record from the wallet and JSON.parse()
 * @param {Wallet} wallet
 * @param {string} type
 * @param {string} id
 * @return {Promise<object>} value
 */
exports.get = async (wallet, type, id) => {
    try {
        const record = await sdk.getWalletRecord(wallet.handle, type, id, {});
        return JSON.parse(record.value);
    } catch (err) {
        if (!isWalletNotFoundError(err)) {
            throw err;
        }
    }
    return;
};

/**
 * Sets a record in the wallet
 * Convenience method to add or update a record in the wallet
 * @param {Wallet} wallet
 * @param {string} type
 * @param {string} id
 * @param {object} data
 * @param {object} [tags]
 * @return {Promise<object>} data
 */
exports.set = async (wallet, type, id, data, tags) => {
    const record = await exports.get(wallet, type, id);
    if (!record) {
        return await sdk.addWalletRecord(wallet.handle, type, id, JSON.stringify(data), tags);
    }
    if (data) {
        await sdk.updateWalletRecordValue(wallet.handle, type, id, JSON.stringify(data));
    }
    if (tags) {
        await sdk.updateWalletRecordTags(wallet.handle, type, id, tags);
    }
    return data;
};

/**
 * Delete a record from the wallet
 * @param {Wallet} wallet
 * @param {string} type
 * @param {string} id
 * @return {Promise<void>} resolves when deleted or error
 */
exports.remove = async (wallet, type, id) => {
    return await sdk.deleteWalletRecord(wallet.handle, type, id);
};
