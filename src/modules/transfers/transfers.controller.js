'use strict';
const service = require('./transfers.service');
const { ok, created, paginate } = require('../../utils/ApiResponse');

async function list(req, res) {
  const { items, total } = await service.list(req.user, req.query);
  return ok(res, paginate(items, { page: req.query.page, limit: req.query.limit, total }));
}

async function getOne(req, res) {
  return ok(res, await service.getById(req.user, req.params.id));
}

async function create(req, res) {
  return created(res, await service.create(req.user, req.body, req.ip), 'Transfer created');
}

async function approve(req, res) {
  return ok(res, await service.approve(req.user, req.params.id, req.ip, req.body.note), 'Transfer approved');
}

async function dispatch(req, res) {
  return ok(res, await service.dispatch(req.user, req.params.id, req.ip, req.body.note), 'Transfer dispatched');
}

async function inTransit(req, res) {
  return ok(res, await service.inTransit(req.user, req.params.id, req.ip, req.body.note), 'Transfer in transit');
}

async function deliver(req, res) {
  return ok(res, await service.deliver(req.user, req.params.id, req.ip, req.body.note), 'Transfer delivered');
}

async function receive(req, res) {
  return ok(res, await service.receive(req.user, req.params.id, req.ip, req.body.note), 'Transfer received');
}

async function cancel(req, res) {
  return ok(res, await service.cancel(req.user, req.params.id, req.ip, req.body.note), 'Transfer cancelled');
}

module.exports = { list, getOne, create, approve, dispatch, inTransit, deliver, receive, cancel };
