'use strict';
const service = require('./analytics.service');
const { ok } = require('../../utils/ApiResponse');

async function overview(req, res) {
  return ok(res, await service.overview(req.user));
}

async function throughput(req, res) {
  return ok(res, await service.throughput(req.user, req.query.days));
}

async function stockByCategory(req, res) {
  return ok(res, await service.stockByCategory(req.user));
}

async function lowStock(req, res) {
  return ok(res, await service.lowStock(req.user));
}

async function fastMoving(req, res) {
  return ok(res, await service.fastMoving(req.user, req.query.limit));
}

module.exports = { overview, throughput, stockByCategory, lowStock, fastMoving };
