const log = require('./log');
const sdkDid = require('./did');

module.exports = exports = {};

/**
 * did doc context descriptor
 */
const DID_DOC_CONTEXT = 'https://w3id.org/did/v1';

/**
 * supported did methods
 */
const DID_METHOD = {
    PEER: 'did:peer'
};

/**
 * supported key types
 */
const KEY_TYPE = {
    Ed25519VerificationKey2018: {
        name: 'Ed25519VerificationKey2018',
        keyName: 'publicKeyBase58'
    }
};

const SERVICE_TYPE = {
    DIDCOMM: 'did-communication'
};

const didMethods = Object.values(DID_METHOD);

exports.DID_DOC_CONTEXT = DID_DOC_CONTEXT;
exports.DID_METHOD = DID_METHOD;

/**
 * Separate did from didMethod
 * @param {string} didWithMethod
 * @return {array} [didMethod, did]
 */
exports.parseDidWithMethod = function(didWithMethod) {
    for (let i = 0; i < didMethods.length; i++) {
        const didMethod = didMethods[i];
        if (didWithMethod.startsWith(didMethod)) {
            // exclude ':' at end of did method when fetching did
            const did = didWithMethod.substring(didMethod.length + 1);
            return [didMethod, did];
        }
    }
    log.warn('received did with unsupported method', didWithMethod);
    throw new Error('unsupported did method');
};

/**
 * Resolve did key from diddoc document (currently only did:peer)
 * @param {string} did
 * @param {object} diddoc
 * @return {Promise<string>} key
 */
exports.resolveDidKey = async function(did, diddoc) {
    const [, keyId] = did.split('#');
    if (!keyId) {
        if (!did.startsWith('did:')) {
            // is already a key, so return
            return did;
        }
        log.warn('failed to resolve did key, did does not specify id', did);
        throw Error('did does not specify key id');
    }
    const keyField = diddoc.publicKey.find(v => v.id === keyId);
    const keyType = KEY_TYPE[keyField.type];
    if (!keyType) {
        log.warn('failed to resolve did key with unsupported key type', keyField.type);
        throw Error('unsupported key type ' + keyField.type);
    }
    return keyField[keyType.keyName];
};

/**
 * Stub to resolve did service endpoint from diddoc or ledger
 * @param {object} wallet
 * @param {string} serviceEndpoint
 * @param {object} diddoc
 * @return {Promise<string>} endpoint
 */
exports.resolveDidServiceEndpoint = async function(wallet, serviceEndpoint, diddoc) {
    if (serviceEndpoint.startsWith('did:')) {
        log.warn('tried to resolve did as serviceEndpoint which is currently unsupported', serviceEndpoint);
        throw Error('did as serviceEndpoint are currently unsupported');
    }
    return serviceEndpoint;
};

/**
 * Extract didcomm service endpoint information from diddoc
 * @param {wallet} wallet
 * @param {object} diddoc
 * @return {Promise<object>} { recipientKeys: [ .. ], routingKeys: [ .. ], serviceEndpoint: "string" }
 */
exports.getDidcommService = async function(wallet, diddoc) {
    const didcommService = diddoc.service
        .filter(v => (v.type = SERVICE_TYPE.DIDCOMM))
        .sort((a, b) => a.priority - b.priority)[0];
    if (!didcommService) {
        return;
    }
    const recipientKeys = await Promise.all(
        didcommService.recipientKeys.map(async v => await exports.resolveDidKey(v, diddoc))
    );
    const routingKeys = await Promise.all(
        didcommService.routingKeys.map(async v => await exports.resolveDidKey(v, diddoc))
    );
    const serviceEndpoint = await exports.resolveDidServiceEndpoint(wallet, didcommService.serviceEndpoint, diddoc);
    return { recipientKeys, routingKeys, serviceEndpoint };
};

/**
 * Build did:peer diddoc
 * @param {string} did
 * @param {object} wallet
 * @param {object} domainWallet
 * @return {Promise<object>} diddoc
 */
exports.buildPeerDidDoc = async function(did, wallet, domainWallet) {
    const didPeer = DID_METHOD.PEER + ':';
    const didWithMethod = didPeer + did;
    const recipientKey = await sdkDid.localKeyOf(wallet, did);
    const routingKey = await sdkDid.localKeyOf(wallet, await wallet.getEndpointDid());
    const domainDid = await domainWallet.getServiceEndpointDid();
    const domainKey = await sdkDid.localKeyOf(domainWallet, domainDid);
    const domainEndpoint = await domainWallet.getServiceEndpoint();

    return {
        '@context': DID_DOC_CONTEXT,
        id: didWithMethod,
        publicKey: [
            {
                id: '1',
                type: KEY_TYPE.Ed25519VerificationKey2018.name,
                controller: didWithMethod,
                [KEY_TYPE.Ed25519VerificationKey2018.keyName]: recipientKey
            },
            {
                id: '2',
                type: KEY_TYPE.Ed25519VerificationKey2018.name,
                controller: didWithMethod,
                [KEY_TYPE.Ed25519VerificationKey2018.keyName]: routingKey
            },
            {
                id: '3',
                type: KEY_TYPE.Ed25519VerificationKey2018.name,
                controller: didPeer + domainDid,
                [KEY_TYPE.Ed25519VerificationKey2018.keyName]: domainKey
            }
        ],
        authentication: [
            /* TODO */
        ],
        service: [
            {
                id: didWithMethod + ';' + SERVICE_TYPE.DIDCOMM,
                type: SERVICE_TYPE.DIDCOMM,
                priority: 0,
                recipientKeys: [didWithMethod + '#1'],
                routingKeys: [didWithMethod + '#2', didWithMethod + '#3'],
                serviceEndpoint: domainEndpoint
            }
        ]
    };
};
