/**
 * IDChain Agent REST API
 * Pool Ledger Representation
 */

const fs = require('fs');
const agent = require('superagent');
const sdk = require('indy-sdk');

const log = require('./log');

const poolGenesisFile = 'pool_transactions_genesis';
const tmpGenesisPath = `/tmp/${poolGenesisFile}`;

/**
 * Wrap submit function to retry it
 * (seems like indy sometimes needs this when fetching information)
 * @param {function} submitFn
 * @return {function} async function which wraps submitFn
 */
function retrySubmit(submitFn) {
    return async function(...params) {
        let result;
        for (let i = 0; i < 3; i++) {
            result = await submitFn(...params);
            if (['REJECT', 'REQNACK'].includes(result['op']) || result['result']['data'] != null) {
                break;
            }
            await new Promise((resolve, reject) => setTimeout(resolve, 500 * i));
        }
        return result;
    };
}

/**
 * Pool Representation
 */
class PoolLedger {
    /**
     * @param {String} name pool name
     * @param {Object} config pool config { genesis_txn: <string> }
     * @param {Object} [runtimeConfig] { timeout: <number>, extended_timeout: <number>, preordered_nodes: [string] }
     * @param {Object} [info] { ip: <string>, port: <number> }
     */
    constructor(name, config, runtimeConfig, info = {}) {
        this.name = name;
        this.config = config;
        this.runtimeConfig = runtimeConfig;
        this.poolInfo = info;
        this.handle = -1;
    }

    /**
     * @param {String} name pool name
     * @param {Object} config config object
     * @param {Object} [runtimeConfig] { timeout: <number>, extended_timeout: <number>, preordered_nodes: [string] }
     * @param {Object} [info] { ip: <string>, port: <number> }
     */
    setup(name, config, runtimeConfig, info = {}) {
        this.name = name;
        this.config = config;
        this.runtimeConfig = runtimeConfig;
        this.poolInfo = info;
        this.handle = -1;
    }

    /**
     * Create Pool Ledger Config
     */
    async createConfig() {
        await sdk.setProtocolVersion(2);
        if (this.poolInfo.ip && this.poolInfo.port && !fs.existsSync(this.config.genesis_txn)) {
            // Read from test pool http server
            try {
                log.info('Get genesis file from pool IP %s port %s', this.poolInfo.ip, this.poolInfo.port);
                const res = await agent
                    .get(`http://${this.poolInfo.ip}:${this.poolInfo.port}/${poolGenesisFile}`)
                    .responseType('arrayBuffer');
                const poolTransactionsGenesis = Buffer.from(res.body).toString('utf-8');
                await fs.writeFileSync(tmpGenesisPath, poolTransactionsGenesis);
                this.config.genesis_txn = tmpGenesisPath;
                log.info('saved retrieved genesis_txn at', tmpGenesisPath);
            } catch (err) {
                log.warn(err);
                log.info('failed to retrieve pool transactions genesis from pool ip');
            }
        }
        log.info('Creating pool ledger config', this.name, this.config);
        await sdk.createPoolLedgerConfig(this.name, this.config);
    }

    /**
     * Open Ledger connection
     */
    async open() {
        log.info('providing pool handle for pool_name %s', this.name);
        this.handle = await sdk.openPoolLedger(this.name, this.runtimeConfig);
        log.info('connection to pool ledger established');
    }

    /**
     * Retrieves schemas, credDefs, revStates, revRegDefs, and revRegs from ledger.
     * Note that it uses timestamps from the given proof.
     * @param {String} submitterDid did to use for submitting requests to ledger
     * @param {Object[]} identifiers Array of objects containing schemaId, credDefId, and revRegId
     * @return {Promise<Any[]>} [schemas, credDefs, revRegDefs, revRegs]
     */
    async verifierGetEntitiesFromLedger(submitterDid, identifiers) {
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
                const [revocRegDefId, revRegDef] = await this.getRevocRegDef(submitterDid, item['rev_reg_id']);
                revRegDefs[revocRegDefId] = revRegDef;
                const [, revReg, timestamp] = await this.getRevocReg(
                    submitterDid,
                    item['rev_reg_id'],
                    item['timestamp']
                );
                if (!revRegs[revocRegDefId]) {
                    revRegs[revocRegDefId] = {};
                }
                revRegs[revocRegDefId][timestamp] = revReg;
            }
        }
        return [schemas, credDefs, revRegDefs, revRegs];
    }

    /**
     * Retrieve NYM record from the ledger
     * @param {string} submitterDid
     * @param {string} targetDid
     * @return {Promise<Object>} NymResponse
     */
    async getNym(submitterDid, targetDid) {
        return this._request(sdk.buildGetNymRequest, sdk.submitRequest, [submitterDid, targetDid], []);
    }

    /**
     * Create, sign, and submit nym request to ledger.
     * @param {any} walletHandle
     * @param {any} submitterDid
     * @param {any} targetDid
     * @param {any} verkey
     * @param {any} alias
     * @param {any} role
     * @return {Promise<Object>} IndyResponse
     * @throws APIResult on error
     */
    async nymRequest(walletHandle, submitterDid, targetDid, verkey, alias, role) {
        return this._request(
            sdk.buildNymRequest,
            sdk.signAndSubmitRequest,
            [submitterDid, targetDid, verkey, alias, role && role !== 'NONE' ? role : null],
            [walletHandle, submitterDid]
        );
    }

    /**
     * Retrieve did attribute from ledger
     * @param {string} submitterDid
     * @param {string} targetDid
     * @param {string} [raw]
     * @param {string} [hash]
     * @param {string} [enc]
     */
    async getAttrib(submitterDid, targetDid, raw, hash, enc) {
        return this._request(
            sdk.buildGetAttribRequest,
            sdk.submitRequest,
            [submitterDid, targetDid, raw, hash, enc],
            []
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
     * @return {Promise<Object>} IndyResponse
     * @throws APIResult on error
     */
    async attribRequest(walletHandle, submitterDid, targetDid, hash, raw, enc) {
        return this._request(
            sdk.buildAttribRequest,
            sdk.signAndSubmitRequest,
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
            sdk.buildSchemaRequest,
            sdk.signAndSubmitRequest,
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
            sdk.buildCredDefRequest,
            sdk.signAndSubmitRequest,
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
            sdk.buildRevocRegDefRequest,
            sdk.signAndSubmitRequest,
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
        return this._request(
            sdk.buildRevocRegEntryRequest,
            sdk.signAndSubmitRequest,
            [submitterDid, revocRegDefId, revDefType, value],
            [walletHandle, submitterDid]
        );
    }

    /**
     * Retrieve Schema from ledger
     * @param {String} submitterDid
     * @param {String} schemaId
     * @return {Promise<any[]>} [schemaId, schema]
     * @throws APIResult on error
     */
    async getSchema(submitterDid, schemaId) {
        return this._get(
            sdk.buildGetSchemaRequest,
            sdk.submitRequest,
            sdk.parseGetSchemaResponse,
            [submitterDid, schemaId],
            []
        );
    }

    /**
     * Retrieve Credential Definition from ledger
     * @param {String} submitterDid
     * @param {String} credDefId
     * @return {Promise<Any[]>} [credDefId, credDef]
     * @throws APIResult on error
     */
    async getCredDef(submitterDid, credDefId) {
        return this._get(
            sdk.buildGetCredDefRequest,
            sdk.submitRequest,
            sdk.parseGetCredDefResponse,
            [submitterDid, credDefId],
            []
        );
    }

    /**
     * Retrieve Revocation Registry Definition from ledger
     * @param {String} submitterDid
     * @param {String} revocRegDefId
     * @return {Promise<any[]>} resolves to [revocRegDefId, revocRegDef]
     * @throws APIResult on error
     */
    async getRevocRegDef(submitterDid, revocRegDefId) {
        return this._get(
            sdk.buildGetRevocRegDefRequest,
            sdk.submitRequest,
            sdk.parseGetRevocRegDefResponse,
            [submitterDid, revocRegDefId],
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
            sdk.buildGetRevocRegRequest,
            sdk.submitRequest,
            sdk.parseGetRevocRegResponse,
            [submitterDid, revocRegId, totime],
            []
        );
    }

    /**
     *
     * @param {String} submitterDid
     * @param {String} revocRegDefId
     * @param {Number} fromtime   starting time of accumulator's changes
     * @param {Number} totime  ending time of accumulator's changes
     * @return {Promise<void>}
     */
    async getRevocRegDelta(submitterDid, revocRegDefId, fromtime, totime) {
        return this._get(
            sdk.buildGetRevocRegDeltaRequest,
            sdk.submitRequest,
            sdk.parseGetRevocRegDeltaResponse,
            [submitterDid, revocRegDefId, fromtime, totime],
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
     * @return {Promise<Array>} List of transactions
     * @throws APIResult on error
     */
    async getLedgerTransactions(walletHandle, submitterDid, from, to, type) {
        const response = [];
        for (let i = from; i < to; i++) {
            response.push(
                await this._request(
                    sdk.buildGetTxnRequest,
                    sdk.signAndSubmitRequest,
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
     * @return {Promise<Object>} parsed response
     * @throws APIResult on error
     */
    async _get(buildFn, submitFn, parseFn, buildOpts, submitOpts) {
        const result = await this._request(buildFn, retrySubmit(submitFn), buildOpts, submitOpts);
        return parseFn(result);
    }

    /**
     * Build and submit request to ledger.
     * @param {Function} buildFn request build function
     * @param {Function} submitFn request submit function
     * @param {Any[]} buildOpts build function arguments
     * @param {Any[]} submitOpts submit function arguments
     * @return {Promise<Object>} response
     * @throws APIResult on error
     */
    async _request(buildFn, submitFn, buildOpts, submitOpts) {
        const request = await buildFn(...buildOpts);
        const result = await submitFn(this.handle, ...submitOpts, request);
        if (['REJECT', 'REQNACK'].includes(result['op'])) {
            log.warn(result);
            const error = new Error(result['reason']);
            error.status = 400;
            throw error;
        }
        return result;
    }
}

exports = module.exports = new PoolLedger();
exports.class = PoolLedger;
