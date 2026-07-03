'use strict';

/**
 * Generates a human-friendly, collision-resistant document code, e.g. "TR-LQ4F8A21".
 * Prefix examples: TR (transfer), SL (sale).
 */
function genCode(prefix) {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.floor(Math.random() * 46656).toString(36).toUpperCase().padStart(3, '0');
  return `${prefix}-${stamp}${rand}`;
}

module.exports = { genCode };
