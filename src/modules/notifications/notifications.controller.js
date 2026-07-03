'use strict';
const service = require('./notifications.service');
const { ok, paginate } = require('../../utils/ApiResponse');

async function list(req, res) {
  const { items, total, unreadCount } = await service.list(req.user, req.query);
  return ok(res, {
    ...paginate(items, { page: req.query.page, limit: req.query.limit, total }),
    unreadCount,
  });
}

async function markRead(req, res) {
  return ok(res, await service.markRead(req.user, req.params.id), 'Notification marked read');
}

async function markAllRead(req, res) {
  return ok(res, await service.markAllRead(req.user), 'All notifications marked read');
}

module.exports = { list, markRead, markAllRead };
