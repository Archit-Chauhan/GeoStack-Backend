'use strict';
const http = require('http');
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { connectDB } = require('./db/connect');
const { initSocket } = require('./socket');

async function start() {
  await connectDB();

  const server = http.createServer(app);
  initSocket(server);

  server.listen(config.port, () => {
    logger.info(`GeoStock API listening on :${config.port} (${config.env})`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down…`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Only auto-start when run directly (tests import app.js instead).
if (require.main === module) {
  start().catch((err) => {
    logger.error('Failed to start server', err);
    process.exit(1);
  });
}

module.exports = { start };
