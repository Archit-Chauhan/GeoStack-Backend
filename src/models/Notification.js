'use strict';
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    // null user = broadcast to the whole company
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    type: { type: String, required: true }, // low_stock | transfer_request | transfer_update | inventory_update | sale
    title: { type: String, required: true },
    message: { type: String, default: '' },
    level: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
    read: { type: Boolean, default: false, index: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

notificationSchema.index({ company: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
