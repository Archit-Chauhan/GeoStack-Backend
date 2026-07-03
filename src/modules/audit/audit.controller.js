'use strict';
const service = require('./audit.service');
const { ok, paginate } = require('../../utils/ApiResponse');

async function list(req, res) {
  const { items, total } = await service.list(req.user, req.query);
  return ok(res, paginate(items, { page: req.query.page, limit: req.query.limit, total }));
}

module.exports = { list };
