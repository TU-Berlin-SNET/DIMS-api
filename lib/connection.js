/**
 * Connection Initiator
 */
const INITIATOR = {
    ME: 'ME',
    OTHER: 'OTHER'
};

/**
 * Connection State
 */
const STATE = {
    NULL: 'NULL',
    INVITED: 'INVITED',
    REQUESTED: 'REQUESTED',
    RESPONDED: 'RESPONDED',
    COMPLETE: 'COMPLETE',
    ERRORED: 'ERRORED'
};

/**
 * Connection State Direction
 */
const STATE_DIRECTION = {
    IN: 'IN',
    OUT: 'OUT'
};

module.exports = class Connection {
    /**
     *
     * @param {object} options
     */
    constructor(options = {}) {
        this.id = options.id;
        this.label = options.label;
        this.initiator = options.initiator || INITIATOR.ME;
        this.state = options.state || STATE.NULL;
        this.stateDirection = options.stateDirection;
        this.threadId = options.threadId;
        this.invitation = options.invitation;
        this.request = options.request;
        this.response = options.response;
        this.error = options.error;
        this.myDid = options.myDid;
        this.myKey = options.myKey;
        this.myDidDoc = options.myDidDoc;
        this.theirDid = options.theirDid;
        this.theirKey = options.theirKey;
        this.theirDidDoc = options.theirDidDoc;
        this.endpoint = options.endpoint;
        this.meta = options.meta;
        this.createdAt = options.createdAt;
        this.updatedAt = options.updatedAt;
    }

    /**
     * Connection Record Tags
     */
    get tags() {
        return {
            state: this.state,
            stateDirection: this.stateDirection,
            threadId: this.threadId,
            myDid: this.myDid,
            myKey: this.myKey,
            theirDid: this.theirDid,
            theirKey: this.theirKey
        };
    }

    /**
     * @param {(object | string)} options json string or object
     * @return {Connection} connection or null
     */
    static load(options) {
        if (typeof options === 'string') {
            return new Connection(JSON.parse(options));
        }
        if (typeof options === 'object') {
            return new Connection(options);
        }
        return;
    }

    /**
     * Connection Initiator
     */
    static get INITIATOR() {
        return INITIATOR;
    }

    /**
     * Connection State
     */
    static get STATE() {
        return STATE;
    }

    /**
     * Connection State Direction
     */
    static get STATE_DIRECTION() {
        return STATE_DIRECTION;
    }
};
