'use strict';
const mongoose = require('mongoose');

const TRANSFER_STATUSES = [
  'requested',
  'approved',
  'dispatched',
  'in_transit',
  'delivered',
  'received',
  'cancelled',
];

const typeToModel = { warehouse: 'Warehouse', store: 'Store' };

const timelineEntrySchema = new mongoose.Schema(
  {
    status: { type: String, enum: TRANSFER_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String },
  },
  { _id: false }
);

const transferSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    code: { type: String, required: true, unique: true },

    // API-facing type ('warehouse'|'store'); *Model mirrors it for refPath populate.
    fromType: { type: String, enum: ['warehouse', 'store'], required: true },
    fromModel: { type: String, enum: ['Warehouse', 'Store'] },
    from: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'fromModel' },
    toType: { type: String, enum: ['warehouse', 'store'], required: true },
    toModel: { type: String, enum: ['Warehouse', 'Store'] },
    to: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'toModel' },

    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true, min: 1 },
        _id: false,
      },
    ],
    status: { type: String, enum: TRANSFER_STATUSES, default: 'requested', index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    timeline: [timelineEntrySchema],
    distanceKm: { type: Number, default: 0 },
    etaHours: { type: Number, default: 0 },
    notes: { type: String },
  },
  { timestamps: true }
);

// Keep *Model in sync with *Type so refPath populate resolves the right collection.
transferSchema.pre('validate', function (next) {
  if (this.fromType) this.fromModel = typeToModel[this.fromType];
  if (this.toType) this.toModel = typeToModel[this.toType];
  next();
});

transferSchema.statics.STATUSES = TRANSFER_STATUSES;

const Transfer = mongoose.model('Transfer', transferSchema);
Transfer.TRANSFER_STATUSES = TRANSFER_STATUSES;
module.exports = Transfer;
