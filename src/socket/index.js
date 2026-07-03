'use strict';
const { Server } = require('socket.io');
const config = require('../config');
const logger = require('../utils/logger');
const { verifyAccessToken } = require('../utils/tokens');

let io = null;

/** Bootstrap Socket.IO on the shared HTTP server. */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.clientUrl, credentials: true },
  });

  // JWT handshake auth — token passed as socket.handshake.auth.token
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization || '').replace('Bearer ', '');
      if (!token) return next(new Error('unauthorized'));
      const decoded = verifyAccessToken(token);
      socket.user = decoded;
      return next();
    } catch (err) {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { company, warehouse, store, sub } = socket.user || {};
    if (company) socket.join(`company:${company}`);
    if (warehouse) socket.join(`warehouse:${warehouse}`);
    if (store) socket.join(`store:${store}`);
    if (sub) socket.join(`user:${sub}`);
    logger.debug(`socket connected: user ${sub} (company ${company})`);

    socket.on('disconnect', () => logger.debug(`socket disconnected: user ${sub}`));
  });

  return io;
}

function getIO() { return io; }

/* ---- Emit helpers (no-op if socket not initialised, e.g. during tests) ---- */
function emitToCompany(companyId, event, payload) {
  if (io && companyId) io.to(`company:${companyId}`).emit(event, payload);
}
function emitToWarehouse(warehouseId, event, payload) {
  if (io && warehouseId) io.to(`warehouse:${warehouseId}`).emit(event, payload);
}
function emitToStore(storeId, event, payload) {
  if (io && storeId) io.to(`store:${storeId}`).emit(event, payload);
}
function emitToUser(userId, event, payload) {
  if (io && userId) io.to(`user:${userId}`).emit(event, payload);
}

module.exports = {
  initSocket,
  getIO,
  emitToCompany,
  emitToWarehouse,
  emitToStore,
  emitToUser,
};
