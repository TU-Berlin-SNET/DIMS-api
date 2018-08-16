/**
 * Class encapsulating a result from the API
 * May be used for both successful responses
 * and error message propagation
 */
class APIResult {
    /**
     * @param {Number} status HTTP status code
     * @param {Object} data response data
     * @param {Object} error an error
     */
    constructor(status, data, error) {
        this.status = status;
        this.data = data;
        this.error = error;
    }

    /**
     * @return {Object} APIResult with status 400
     */
    static badRequest() {
        return badRequest;
    }

    /**
     * @return {Object} APIResult with status 202
     */
    static accepted() {
        return accepted;
    }
}

const badRequest = new APIResult(400);
const accepted = new APIResult(202);

module.exports = APIResult;
