'use strict';
const service = require('./sales.service');
const { ok, created, paginate } = require('../../utils/ApiResponse');

async function list(req, res) {
  const { items, total } = await service.list(req.user, req.query);
  return ok(res, paginate(items, { page: req.query.page, limit: req.query.limit, total }));
}

async function getOne(req, res) {
  return ok(res, await service.getById(req.user, req.params.id));
}

async function create(req, res) {
  return created(res, await service.create(req.user, req.body, req.ip), 'Sale recorded');
}

async function refund(req, res) {
  return ok(res, await service.refund(req.user, req.params.id, req.ip), 'Sale refunded');
}

module.exports = { list, getOne, create, refund };
