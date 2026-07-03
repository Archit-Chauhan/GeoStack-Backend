'use strict';
const service = require('./inventory.service');
const { ok, paginate } = require('../../utils/ApiResponse');

/** GET /inventory */
async function list(req, res) {
  const { items, total } = await service.list(req.user, req.query);
  return ok(res, paginate(items, { page: req.query.page, limit: req.query.limit, total }));
}

/** GET /inventory/low-stock */
async function lowStock(req, res) {
  return ok(res, await service.lowStock(req.user));
}

/** POST /inventory/adjust */
async function adjust(req, res) {
  return ok(res, await service.adjust(req.user, req.body, req.ip), 'Inventory adjusted');
}

module.exports = { list, lowStock, adjust };
