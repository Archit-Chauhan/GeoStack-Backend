'use strict';
const AuditLog = require('../../models/AuditLog');

async function list(user, query) {
  const { page, limit, entity, entityId, actor, action, sort } = query;
  const filter = { company: user.company };
  if (entity) filter.entity = entity;
  if (entityId) filter.entityId = entityId;
  if (actor) filter.actor = actor;
  if (action) filter.action = action;

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('actor', 'name email role')
      .sort(sort || '-at')
      .skip((page - 1) * limit)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  return { items, total };
}

module.exports = { list };
