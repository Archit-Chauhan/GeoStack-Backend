'use strict';
const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    industry: { type: String, default: 'General' },
    currency: { type: String, default: 'USD' },
    address: {
      line1: String,
      city: String,
      state: String,
      country: String,
      zip: String,
    },
    settings: {
      lowStockThresholdDefault: { type: Number, default: 10 },
    },
    plan: { type: String, enum: ['free', 'pro'], default: 'free' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Company', companySchema);
