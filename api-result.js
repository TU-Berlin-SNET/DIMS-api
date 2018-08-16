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
     * @return {APIResult} APIResult with status 202
     */
    static accepted() {
        return accepted;
    }

    /**
     * @return {APIResult} APIResult with status 204
     */
    static noContent() {
        return noContent;
    }

    /**
     * @return {APIResult} APIResult with status 400
     */
    static badRequest() {
        return badRequest;
    }

    /**
     * @return {APIResult} APIResult with status 404
     */
    static notFound() {
        return notFound;
    }
}

const accepted = new APIResult(202);
const noContent = new APIResult(204);
const badRequest = new APIResult(400);
const notFound = new APIResult(404);

module.exports = APIResult;
