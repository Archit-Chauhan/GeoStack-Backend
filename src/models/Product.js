'use strict';
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, uppercase: true, trim: true },
    category: { type: String, default: 'General', index: true },
    brand: { type: String, default: '' },
    unit: { type: String, default: 'unit' },
    images: [{ type: String }],
    minStock: { type: Number, default: 0 },
    maxStock: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true }
);

productSchema.index({ company: 1, sku: 1 }, { unique: true });
productSchema.index({ company: 1, name: 'text', sku: 'text' });

module.exports = mongoose.model('Product', productSchema);
