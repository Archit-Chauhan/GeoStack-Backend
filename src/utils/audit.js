'use strict';

/**
 * Writes an audit-log entry. Fire-and-safe: never throws into the caller's flow
 * (audit failures must not break a business operation).
 *   writeAudit({ company, actor, action, entity, entityId, before, after, ip })
 */
async function writeAudit(entry) {
  try {
    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({
      company: entry.company,
      actor: entry.actor,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      before: entry.before,
      after: entry.after,
      ip: entry.ip,
    });
  } catch (err) {
    require('./logger').error('audit write failed', err.message);
  }
}

module.exports = { writeAudit };
