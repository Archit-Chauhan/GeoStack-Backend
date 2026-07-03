'use strict';
const { ZodError } = require('zod');
const ApiError = require('../utils/ApiError');

/**
 * Validates and COERCES req.body / req.query / req.params against a Zod schema shaped
 * like { body?, query?, params? }. Replaces each part with the parsed result so
 * controllers receive clean, typed data.
 */
module.exports = function validate(schema) {
  return function (req, _res, next) {
    try {
      if (schema.body) req.body = schema.body.parse(req.body ?? {});
      if (schema.query) req.query = schema.query.parse(req.query ?? {});
      if (schema.params) req.params = schema.params.parse(req.params ?? {});
      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
        return next(ApiError.badRequest('Validation failed', errors));
      }
      return next(err);
    }
  };
};
