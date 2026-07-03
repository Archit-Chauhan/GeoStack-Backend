'use strict';
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true }, // e.g. inventory.adjust, transfer.dispatch
    entity: { type: String, required: true }, // Inventory | Transfer | Product ...
    entityId: { type: mongoose.Schema.Types.ObjectId },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

auditLogSchema.index({ company: 1, at: -1 });
auditLogSchema.index({ company: 1, entity: 1, entityId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
