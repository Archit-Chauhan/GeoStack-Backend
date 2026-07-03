'use strict';
const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/tokens');

/**
 * Verifies the Bearer access token and attaches a lightweight principal to req.user:
 *   { id, role, company, warehouse, store }
 * Services are responsible for company-scoping every query using req.user.company.
 */
module.exports = function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(ApiError.unauthorized('Missing access token'));

  try {
    const decoded = verifyAccessToken(token);
    req.user = {
      id: decoded.sub,
      role: decoded.role,
      company: decoded.company,
      warehouse: decoded.warehouse || null,
      store: decoded.store || null,
    };
    return next();
  } catch (err) {
    return next(ApiError.unauthorized('Invalid or expired access token'));
  }
};
