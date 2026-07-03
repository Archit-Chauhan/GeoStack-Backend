'use strict';
const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema(
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
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

storeSchema.index({ company: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Store', storeSchema);
