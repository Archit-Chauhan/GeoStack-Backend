'use strict';
const service = require('./company.service');
const { ok } = require('../../utils/ApiResponse');

async function getCompany(req, res) {
  return ok(res, await service.getCompany(req.user));
}

async function updateCompany(req, res) {
  return ok(res, await service.updateCompany(req.user, req.body, req.ip), 'Company updated');
}

module.exports = { getCompany, updateCompany };
