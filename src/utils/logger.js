'use strict';
const config = require('../config');

/* Minimal leveled logger; silent during tests to keep output clean. */
const noop = () => {};
const base = config.isTest
  ? { info: noop, warn: noop, error: noop, debug: noop }
  : {
      info: (...a) => console.log('[info]', ...a),
      warn: (...a) => console.warn('[warn]', ...a),
      error: (...a) => console.error('[error]', ...a),
      debug: (...a) => (config.isProd ? undefined : console.debug('[debug]', ...a)),
    };

module.exports = base;
