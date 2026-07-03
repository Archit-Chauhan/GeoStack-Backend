'use strict';
const service = require('./users.service');
const { ok, created, paginate } = require('../../utils/ApiResponse');

async function list(req, res) {
  const { items, total } = await service.list(req.user, req.query);
  return ok(res, paginate(items, { page: req.query.page, limit: req.query.limit, total }));
}

async function invite(req, res) {
  return created(res, await service.invite(req.user, req.body, req.ip), 'User invited');
}

async function getOne(req, res) {
  return ok(res, await service.getById(req.user, req.params.id));
}

async function update(req, res) {
  return ok(res, await service.update(req.user, req.params.id, req.body, req.ip), 'User updated');
}

async function updateRole(req, res) {
  return ok(res, await service.updateRole(req.user, req.params.id, req.body.role, req.ip), 'Role updated');
}

async function remove(req, res) {
  return ok(res, await service.remove(req.user, req.params.id, req.ip), 'User deleted');
}

module.exports = { list, invite, getOne, update, updateRole, remove };
