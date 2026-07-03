'use strict';

module.exports = async function globalTeardown() {
  if (globalThis.__MONGO__) await globalThis.__MONGO__.stop();
};
