'use strict';
const ApiError = require('../utils/ApiError');
const config = require('../config');
const logger = require('../utils/logger');

function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  let error = err;

  // Normalise common non-ApiError errors
  if (!(error instanceof ApiError)) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors || {}).map((e) => ({ path: e.path, message: e.message }));
      error = ApiError.badRequest('Validation failed', errors);
    } else if (error.name === 'CastError') {
      error = ApiError.badRequest(`Invalid ${error.path}: ${error.value}`);
    } else if (error.code === 11000) {
      const field = Object.keys(error.keyValue || { field: '' })[0];
      error = ApiError.conflict(`Duplicate value for ${field}`);
    } else {
      logger.error(error);
      error = new ApiError(error.statusCode || 500, error.message || 'Internal server error');
    }
  }

  const body = { success: false, message: error.message };
  if (error.errors) body.errors = error.errors;
  if (!config.isProd && error.stack) body.stack = error.stack;

  res.status(error.statusCode || 500).json(body);
}

module.exports = { notFound, errorHandler };
