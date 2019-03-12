const defaultLogger = {
    trace(message, ...args) {
        console.trace(message, ...args);
    },

    debug(message, ...args) {
        console.debug(message, ...args);
    },

    info(message, ...args) {
        console.info(message, ...args);
    },

    warn(message, ...args) {
        console.warn(message, ...args);
    },

    error(message, ...args) {
        console.error(message, ...args);
    },

    fatal(message, ...args) {
        console.error(message, ...args);
    }
};

const sdkLogLevels = {
    5: 'trace',
    4: 'debug',
    3: 'info',
    2: 'warn',
    1: 'error',
    0: 'fatal'
};

/**
 * Logger
 */
class Log {
    /**
     * Empty Constructor
     * Sets default logger, can be changed later
     */
    constructor() {
        this.logger = defaultLogger;
    }

    /**
     * log.trace
     * @param {string} message
     * @param {any} args
     */
    trace(message, ...args) {
        this.logger.trace(message, ...args);
    }

    /**
     * log.debug
     * @param {string} message
     * @param {any} args
     */
    debug(message, ...args) {
        this.logger.debug(message, ...args);
    }

    /**
     * log.info
     * @param {string} message
     * @param {any} args
     */
    info(message, ...args) {
        this.logger.info(message, ...args);
    }

    /**
     * log.warn
     * @param {string} message
     * @param {any} args
     */
    warn(message, ...args) {
        this.logger.warn(message, ...args);
    }

    /**
     * log.error
     * @param {string} message
     * @param {any} args
     */
    error(message, ...args) {
        this.logger.error(message, ...args);
    }

    /**
     * log.fatal
     * @param {string} message
     * @param {any} args
     */
    fatal(message, ...args) {
        this.logger.fatal(message, ...args);
    }

    /**
     * SDK Logger Adapter
     * @return {function}
     */
    sdkLog() {
        const self = this;
        return function(level, message, target, modulePath, file, line) {
            const levelName = sdkLogLevels[level] || 'debug';
            self[levelName](message, target, modulePath, file, line);
        };
    }
}

module.exports = new Log();
