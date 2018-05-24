
module.exports = (req, res, next) =>
  next({statusCode: 404, message: 'Sorry there is nothing here'});
