
/**
 * Class encapsulating a result from the API
 * May be used for both successful responses and error handling
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
}

module.exports = APIResult;
