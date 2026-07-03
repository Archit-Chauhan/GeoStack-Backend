'use strict';
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

function signAccessToken(user) {
  const payload = {
    sub: String(user._id),
    role: user.role,
    company: String(user.company),
    warehouse: user.warehouse ? String(user.warehouse) : null,
    store: user.store ? String(user.store) : null,
  };
  return jwt.sign(payload, config.jwt.accessSecret, { expiresIn: config.jwt.accessTtl });
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

/** Refresh tokens are opaque random strings; only their SHA-256 hash is stored. */
function generateRefreshToken() {
  const token = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(token);
  return { token, tokenHash };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Parse a "7d"/"15m"/"3600" style TTL into a future Date. */
function ttlToDate(ttl) {
  const m = String(ttl).match(/^(\d+)([smhd])?$/);
  const now = Date.now();
  if (!m) return new Date(now + 7 * 864e5);
  const n = parseInt(m[1], 10);
  const unit = m[2] || 's';
  const mult = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[unit];
  return new Date(now + n * mult);
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
  ttlToDate,
};
