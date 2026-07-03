'use strict';
const service = require('./stores.service');
const { ok, created, paginate } = require('../../utils/ApiResponse');

async function list(req, res) {
  const { items, total } = await service.list(req.user, req.query);
  return ok(res, paginate(items, { page: req.query.page, limit: req.query.limit, total }));
}

async function getOne(req, res) {
  return ok(res, await service.getById(req.user, req.params.id));
}

async function create(req, res) {
  return created(res, await service.create(req.user, req.body, req.ip), 'Store created');
}

async function update(req, res) {
  return ok(res, await service.update(req.user, req.params.id, req.body, req.ip), 'Store updated');
}

async function remove(req, res) {
  return ok(res, await service.remove(req.user, req.params.id, req.ip), 'Store deleted');
}

async function summary(req, res) {
  return ok(res, await service.summary(req.user, req.params.id));
}

module.exports = { list, getOne, create, update, remove, summary };
