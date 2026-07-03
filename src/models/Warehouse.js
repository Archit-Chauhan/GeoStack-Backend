'use strict';
const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    location: {
      lat: { type: Number, default: 0 },
      lng: { type: Number, default: 0 },
      address: String,
      city: String,
      country: String,
    },
    capacityPallets: { type: Number, default: 0 },
    usedPallets: { type: Number, default: 0 },
    type: { type: String, enum: ['standard', 'cold', 'hub'], default: 'standard' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

warehouseSchema.index({ company: 1, code: 1 }, { unique: true });

warehouseSchema.virtual('utilization').get(function () {
  if (!this.capacityPallets) return 0;
  return Math.round((this.usedPallets / this.capacityPallets) * 100);
});

warehouseSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Warehouse', warehouseSchema);
