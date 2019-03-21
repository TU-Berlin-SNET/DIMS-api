const sdk = require('indy-sdk');
const did = require('./did');
const log = require('./log');
const walletRecord = require('./wallet-record.js');

const configRecord = walletRecord.types.config;
const endpointDidRecord = walletRecord.ids.endpointDid;
const masterSecretIdRecord = walletRecord.ids.masterSecretId;

/**
 * Wallet Class
 */
class Wallet {
    /**
     * @param {object} config
     * @param {object} credentials
     */
    constructor(config, credentials) {
        this.config = config;
        this.credentials = credentials;
        this.handle = -1;
    }

    /**
     * Create underlying indy wallet, primary did, and masterSecretId
     * @param {object} options { seed, masterSecretId }
     * @return {Promise<Wallet>} opened wallet
     */
    async create(options = {}) {
        const { seed, masterSecretId } = options;

        await sdk.createWallet(this.config, this.credentials);
        await this.open();

        const [endpointDid] = await did.create(this.handle, seed ? { seed } : {});
        const secretId = await sdk.proverCreateMasterSecret(this.handle, masterSecretId);
        await this.setEndpointDid(endpointDid);
        await this.setMasterSecretId(secretId);

        return this;
    }

    /**
     * Open Wallet (if not already open)
     */
    async open() {
        log.debug('opening wallet', this.config);
        if (!this.handle || this.handle === -1) {
            this.handle = await sdk.openWallet(this.config, this.credentials);
        }
        return this.handle;
    }

    /**
     * Close Wallet (if open)
     */
    async close() {
        log.debug('closing wallet', this.handle, this.config);
        if (this.handle && this.handle !== -1) {
            await sdk.closeWallet(this.handle);
            this.handle = -1;
        }
    }

    /**
     * Remove Wallet
     */
    async delete() {
        log.debug('deleting wallet', this.config);
        await this.close();
        return await sdk.deleteWallet(this.config, this.credentials);
    }

    /**
     * Retrieve endpoint did
     * @return {Promise<string>} did
     */
    async getEndpointDid() {
        log.debug('retrieving endpoint did', this.config);
        return await walletRecord.retrieve(this, configRecord, endpointDidRecord);
    }

    /**
     * Set endpoint did
     * @param {string} value did
     * @param {object} options { masterSecretId }
     * @return {Promise<Void>}
     */
    async setEndpointDid(value) {
        log.debug('setting endpoint did', this.config, value);
        return await walletRecord.set(this, configRecord, endpointDidRecord, value);
    }

    /**
     * Retrieve master secret id
     * @return {Promise<string>} masterSecretId
     */
    async getMasterSecretId() {
        log.debug('retrieving master secret id', this.config);
        return await walletRecord.retrieve(this, configRecord, masterSecretIdRecord);
    }

    /**
     * Set master secret id
     * @param {string} value masterSecretId
     * @return {Promise<Void>}
     */
    async setMasterSecretId(value) {
        log.debug('setting master secret id', this.config, value);
        return await walletRecord.set(this, configRecord, endpointDidRecord, value);
    }
}

module.exports = Wallet;
