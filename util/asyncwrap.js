/**
 * Wrapper to be used for express async middleware or routes
 * @param {*} fn
 */

module.exports = {
    wrap: fn => (req, res, next) => fn(req, res, next).catch(next),
    wrapNext: fn => (req, res, next) =>
        fn(req, res, next)
            .then(result => {
                if (result) {
                    res.locals.result = result;
                }
            })
            .then(next)
            .catch(next),
    wrapEx: fn => (req, res, next, value) => fn(req, res, next, value).catch(next)
};
