'use strict';
const express = require('express');
const logger = require('../utils/logger');

const apiRouter = express.Router();

apiRouter.get('/health', (_req, res) =>
  res.json({ success: true, message: 'GeoStock API is healthy', data: { uptime: process.uptime() } })
);

// Mount every module router. Defensive: a module that isn't built yet (or fails to
// load) is skipped with a warning instead of crashing the whole API.
const MODULES = [
  ['/auth', 'auth'],
  ['/company', 'company'],
  ['/users', 'users'],
  ['/roles', 'roles'],
  ['/warehouses', 'warehouses'],
  ['/stores', 'stores'],
  ['/products', 'products'],
  ['/inventory', 'inventory'],
  ['/transfers', 'transfers'],
  ['/sales', 'sales'],
  ['/analytics', 'analytics'],
  ['/notifications', 'notifications'],
  ['/audit', 'audit'],
];

for (const [mount, name] of MODULES) {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const router = require(`../modules/${name}/${name}.routes`);
    apiRouter.use(mount, router);
  } catch (err) {
    logger.warn(`Module '${name}' not mounted: ${err.message}`);
  }
}

module.exports = apiRouter;
