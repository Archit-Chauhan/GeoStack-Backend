'use strict';
const service = require('./roles.service');
const { ok } = require('../../utils/ApiResponse');

async function list(req, res) {
  return ok(res, await service.list());
}

module.exports = { list };
