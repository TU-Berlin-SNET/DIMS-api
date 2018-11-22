/**
 * IDChain Agent REST API
 * Pool Ledger Representation
 */

const util = require('util');
const indy = require('indy-sdk');
const APIResult = require('../api-result');
const log = require('../log').log;

/**
 * Pool Representation
 */
class PoolLedger {
    /**
     * @param {String} name pool name
     * @param {Object} config config object
     */
    constructor(name, config) {
        this.name = name;
        this.config = config;
        this.handle = -1;
    }

    /**
     * Create Pool Ledger Config
     */
    async createConfig() {
        await indy.setProtocolVersion(2);
        log.info('Creating pool ledger config %s with %s', this.name, util.inspect(this.config));
        await indy.createPoolLedgerConfig(this.name, this.config);
    }

    /**
     * Open Ledger connection
     */
    async openLedger() {
        log.info('providing pool handle for pool_name %s', process.env.POOL_NAME);
        this.handle = await indy.openPoolLedger(process.env.POOL_NAME);
        log.info('connection to pool ledger established');
    }

    /**
     * Retrieves schemas, credDefs, revStates, revRegDefs, and revRegs from ledger.
     * @param {String} submitterDid did to use for submitting requests to ledger
     * @param {Object[]} identifiers Array of objects containing schemaId, credDefId, and revRegId
     * @return {Any[]} [schemas, credDefs, revStates]
     */
    async proverGetEntitiesFromLedger(submitterDid, identifiers) {
        const now = Math.floor(Date.now() / 1000);
        return this.getEntitiesFromLedger(submitterDid, identifiers, item => [
            now,
            this.getRevocRegDelta(submitterDid, item['rev_reg_id'], 0, now)
        ]);
    }

    /**
     * Retrieves schemas, credDefs, revStates, revRegDefs, and revRegs from ledger.
     * Note that it uses timestamps from the given proof.
     * @param {String} submitterDid did to use for submitting requests to ledger
     * @param {Object[]} identifiers Array of objects containing schemaId, credDefId, and revRegId
     * @return {Any[]} [schemas, credDefs, revRegDefs, revRegs]
     */
    async verifierGetEntitiesFromLedger(submitterDid, identifiers) {
        return this.getEntitiesFromLedger(submitterDid, identifiers, item => [
            item['timestamp'],
            this.getRevocReg(submitterDid, item['rev_reg_id'], item['timestamp'])
        ]);
    }

    /**
     * Retrieve NYM record from the ledger
     * @param {string} submitterDid
     * @param {string} targetDid
     * @return {Object} NymResponse
     */
    async getNym(submitterDid, targetDid) {
        return await this._request(indy.buildGetNymRequest, indy.submitRequest, [submitterDid, targetDid], []);
    }

    /**
     * Create, sign, and submit nym request to ledger.
     * @param {any} walletHandle
     * @param {any} submitterDid
     * @param {any} targetDid
     * @param {any} verkey
     * @param {any} alias
     * @param {any} role
     * @return {Object} IndyResponse
     * @throws APIResult on error
     */
    async nymRequest(walletHandle, submitterDid, targetDid, verkey, alias, role) {
        return await this._request(
            indy.buildNymRequest,
            indy.signAndSubmitRequest,
            [submitterDid, targetDid, verkey, alias, role && role !== 'NONE' ? role : null],
            [walletHandle, submitterDid]
        );
    }

    /**
     * Create, sign, and submit attrib request to ledger.
     * @param {Number} walletHandle
     * @param {String} submitterDid
     * @param {String} targetDid
     * @param {String} hash (Optional) Hash of attribute data
     * @param {Json} raw (Optional) Json, where key is attribute name and value is attribute value
     * @param {String} enc (Optional) Encrypted attribute data
     * @return {Object} IndyResponse
     * @throws APIResult on error
     */
    async attribRequest(walletHandle, submitterDid, targetDid, hash, raw, enc) {
        return await this._request(
            indy.buildAttribRequest,
            indy.signAndSubmitRequest,
            [submitterDid, targetDid, hash, raw, enc],
            [walletHandle, submitterDid]
        );
    }

    /**
     * Submit a schema to the ledger.
     * @param {Number} walletHandle
     * @param {String} submitterDid
     * @param {Object} data the schema
     * @return {Promise} a promise which resolves when the request is completed
     */
    schemaRequest(walletHandle, submitterDid, data) {
        return this._request(
            indy.buildSchemaRequest,
            indy.signAndSubmitRequest,
            [submitterDid, data],
            [walletHandle, submitterDid]
        );
    }

    /**
     * Submit a credential definition to the ledger.
     * @param {Number} walletHandle
     * @param {String} submitterDid
     * @param {Object} data the credential definition
     * @return {Promise} a promise which resolves when the request is completed
     */
    credDefRequest(walletHandle, submitterDid, data) {
        return this._request(
            indy.buildCredDefRequest,
            indy.signAndSubmitRequest,
            [submitterDid, data],
            [walletHandle, submitterDid]
        );
    }

    /**
     * Submit a revocation registry definition to the ledger.
     * @param {Number} walletHandle
     * @param {String} submitterDid
     * @param {Object} data the revocRegDef
     * @return {Promise} a promise which resolves to the response
     */
    revocRegDefRequest(walletHandle, submitterDid, data) {
        return this._request(
            indy.buildRevocRegDefRequest,
            indy.signAndSubmitRequest,
            [submitterDid, data],
            [walletHandle, submitterDid]
        );
    }

    /**
     * Submit a revocation registry entry to the ledger.
     * @param {Number} walletHandle
     * @param {String} submitterDid
     * @param {String} revocRegDefId ID of the corresponding RevocRegDef
     * @param {String} revDefType revocation registry type
     * @param {Object} value registry specific data
     * @return {Promise} a promise which resolves to the response
     */
    async revocRegEntryRequest(walletHandle, submitterDid, revocRegDefId, revDefType, value) {
        return await this._request(
            indy.buildRevocRegEntryRequest,
            indy.signAndSubmitRequest,
            [submitterDid, revocRegDefId, revDefType, value],
            [walletHandle, submitterDid]
        );
    }

    /**
     * Retrieve Schema from ledger
     * @param {String} submitterDid
     * @param {String} schemaId
     * @return {any[]} [schemaId, schema]
     * @throws APIResult on error
     */
    async getSchema(submitterDid, schemaId) {
        return await this._get(
            indy.buildGetSchemaRequest,
            indy.submitRequest,
            indy.parseGetSchemaResponse,
            [submitterDid, schemaId],
            []
        );
    }

    /**
     * Retrieve Credential Definition from ledger
     * @param {String} submitterDid
     * @param {String} credDefId
     * @return {Any[]} [credDefId, credDef]
     * @throws APIResult on error
     */
    async getCredDef(submitterDid, credDefId) {
        return await this._get(
            indy.buildGetCredDefRequest,
            indy.submitRequest,
            indy.parseGetCredDefResponse,
            [submitterDid, credDefId],
            []
        );
    }

    /**
     * Retrieve Revocation Registry Definition from ledger
     * @param {String} submitterDid
     * @param {String} revocRegId
     * @return {Promise} resolves to [revocRegDefId, revocRegDef]
     * @throws APIResult on error
     */
    async getRevocRegDef(submitterDid, revocRegId) {
        return this._get(
            indy.buildGetRevocRegDefRequest,
            indy.submitRequest,
            indy.parseGetRevocRegDefResponse,
            [submitterDid, revocRegId],
            []
        );
    }

    /**
     *
     * @param {String} submitterDid
     * @param {String} revocRegId
     * @param {Number} totime   final time of accumulator's changes
     * @return {Promise<void>}
     */
    async getRevocReg(submitterDid, revocRegId, totime) {
        return this._get(
            indy.buildGetRevocRegRequest,
            indy.submitRequest,
            indy.parseGetRevocRegResponse,
            [submitterDid, revocRegId, totime],
            []
        );
    }
    /**
     *
     * @param {String} submitterDid
     * @param {String} revocRegId
     * @param {Number} fromtime   starting time of accumulator's changes
     * @param {Number} totime  ending time of accumulator's changes
     * @return {Promise<void>}
     */
    async getRevocRegDelta(submitterDid, revocRegId, fromtime, totime) {
        return this._get(
            indy.buildGetRevocRegDeltaRequest,
            indy.submitRequest,
            indy.parseGetRevocRegDeltaResponse,
            [submitterDid, revocRegId, fromtime, totime],
            []
        );
    }

    /**
     * Get Ledger Transactions using from and to indexes
     * @param {Number} walletHandle
     * @param {String} submitterDid
     * @param {Number} from
     * @param {Number} to
     * @param {String} type, Ledger type: pool, domain, config
     * @return {Array} List of transactions
     * @throws APIResult on error
     */
    async getLedgerTransactions(walletHandle, submitterDid, from, to, type) {
        const response = [];
        for (let i = from; i < to; i++) {
            response.push(
                await this._request(
                    indy.buildGetTxnRequest,
                    indy.signAndSubmitRequest,
                    [submitterDid, type.toUpperCase(), i],
                    [walletHandle, submitterDid]
                )
            );
        }
        return response
            .filter(r => typeof r.result === 'object')
            .filter(r => r.result.data !== null)
            .map(r => r.result.data);
    }

    /**
     * Build and submit request to ledger and
     * return parsed response.
     * @param {Function} buildFn request build function
     * @param {Function} submitFn request submit function
     * @param {Function} parseFn response parse function
     * @param {Any[]} buildOpts build function arguments
     * @param {Any[]} submitOpts submit function arguments
     * @return {Object} parsed response
     * @throws APIResult on error
     */
    async _get(buildFn, submitFn, parseFn, buildOpts, submitOpts) {
        const result = await this._request(buildFn, submitFn, buildOpts, submitOpts);
        return await parseFn(result);
    }

    /**
     * Retrieves schemas, credDefs, revStates, revRegDefs, and revRegs from ledger.
     * @param {String} submitterDid did to use for submitting requests to ledger
     * @param {Object[]} identifiers Array of objects containing schemaId, credDefId, and revRegId
     * @param {Function} getAccumulatorFn provides lambda to obtain revoc registry entry suitable for a context
     * @return {Any[]} [schemas, credDefs,  revRegDefs, revRegs]
     */
    async getEntitiesFromLedger(submitterDid, identifiers, getAccumulatorFn) {
        let schemas = {};
        let credDefs = {};
        let revRegDefs = {};
        let revRegs = {};
        for (const item of identifiers) {
            const [schemaId, schema] = await this.getSchema(submitterDid, item['schema_id']);
            schemas[schemaId] = schema;
            const [credDefId, credDef] = await this.getCredDef(submitterDid, item['cred_def_id']);
            credDefs[credDefId] = credDef;

            if (item.rev_reg_id) {
                const [revRegDefId, revRegDef] = await this.getRevocRegDef(submitterDid, item['rev_reg_id']);
                revRegDefs[revRegDefId] = revRegDef;
                const [fromtime, [, revRegDelta]] = await getAccumulatorFn(item);
                revRegs[revRegDefId][fromtime] = revRegDelta;
            }
        }

        return [schemas, credDefs, revRegDefs, revRegs];
    }

    /**
     * Build and submit request to ledger.
     * @param {Function} buildFn request build function
     * @param {Function} submitFn request submit function
     * @param {Any[]} buildOpts build function arguments
     * @param {Any[]} submitOpts submit function arguments
     * @return {Object} response
     * @throws APIResult on error
     */
    async _request(buildFn, submitFn, buildOpts, submitOpts) {
        log.debug(
            'pool_request; buildFn %s, requestFn %s, buildOpts %j, submitOpts %j',
            buildFn.name,
            submitFn.name,
            buildOpts,
            submitOpts
        );
        const request = await buildFn(...buildOpts);
        const result = await submitFn(this.handle, ...submitOpts, request);
        if (['REJECT', 'REQNACK'].includes(result['op'])) {
            throw new APIResult(400, result['reason']);
        }
        return result;
    }
}

module.exports = PoolLedger;
