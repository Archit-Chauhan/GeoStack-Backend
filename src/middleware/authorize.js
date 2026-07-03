'use strict';
const ApiError = require('../utils/ApiError');
const { roleHasPermission } = require('../constants/roles');

/**
 * Guards a route by permission string(s). Requires ALL listed permissions.
 * Usage: router.post('/', authenticate, authorize(PERMISSIONS.WAREHOUSES_CREATE), ctrl)
 */
function authorize(...required) {
  return function (req, _res, next) {
    if (!req.user) return next(ApiError.unauthorized());
    const missing = required.filter((p) => !roleHasPermission(req.user.role, p));
    if (missing.length) {
      return next(ApiError.forbidden(`Missing permission: ${missing.join(', ')}`));
    }
    return next();
  };
}

module.exports = authorize;
