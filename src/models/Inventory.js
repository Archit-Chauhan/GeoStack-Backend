'use strict';
const mongoose = require('mongoose');

/** One inventory record per (product, location). locationType picks warehouse|store. */
const inventorySchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    locationType: { type: String, enum: ['warehouse', 'store'], required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: null },
    available: { type: Number, default: 0, min: 0 },
    reserved: { type: Number, default: 0, min: 0 },
    incoming: { type: Number, default: 0, min: 0 },
    outgoing: { type: Number, default: 0, min: 0 },
    damaged: { type: Number, default: 0, min: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Uniqueness per location kind (partial indexes avoid null collisions).
inventorySchema.index(
  { product: 1, warehouse: 1 },
  { unique: true, partialFilterExpression: { warehouse: { $type: 'objectId' } } }
);
inventorySchema.index(
  { product: 1, store: 1 },
  { unique: true, partialFilterExpression: { store: { $type: 'objectId' } } }
);

inventorySchema.virtual('onHand').get(function () {
  return this.available + this.reserved;
});

inventorySchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Inventory', inventorySchema);
