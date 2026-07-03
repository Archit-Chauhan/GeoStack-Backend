'use strict';
const Inventory = require('../../models/Inventory');
const Product = require('../../models/Product');
const Warehouse = require('../../models/Warehouse');
const Store = require('../../models/Store');
const Notification = require('../../models/Notification');
const ApiError = require('../../utils/ApiError');
const { writeAudit } = require('../../utils/audit');
const { emitToCompany } = require('../../socket');

/* Fields we populate on an inventory record for the client. */
const PRODUCT_FIELDS = 'name sku category minStock price unit';

/** Chain the standard populate set onto an Inventory query. */
function withPopulate(query) {
  return query
    .populate('product', PRODUCT_FIELDS)
    .populate('warehouse', 'name code')
    .populate('store', 'name code');
}

/** Socket payload describing an inventory record after a change. */
function inventoryEvent(inv, productId) {
  return {
    inventoryId: inv._id,
    productId,
    locationType: inv.locationType,
    warehouseId: inv.warehouse || undefined,
    storeId: inv.store || undefined,
    available: inv.available,
    reserved: inv.reserved,
    incoming: inv.incoming,
    outgoing: inv.outgoing,
    damaged: inv.damaged,
  };
}

/**
 * GET /inventory — company-scoped list with optional filters.
 * `category` lives on Product, so it is resolved to a set of product ids first.
 * `lowStock` compares available <= product.minStock, which requires the populated
 * product; to keep pagination correct we fetch → filter in memory → slice.
 */
async function list(user, query) {
  const { page, limit, sort, warehouse, store, product, category, locationType, lowStock } = query;

  const filter = { company: user.company };
  if (warehouse) filter.warehouse = warehouse;
  if (store) filter.store = store;
  if (product) filter.product = product;
  if (locationType) filter.locationType = locationType;

  // Resolve the category filter into matching product ids (company-scoped).
  if (category) {
    const products = await Product.find({ company: user.company, category }).select('_id');
    const ids = products.map((p) => p._id);
    if (filter.product) {
      // Both product & category supplied — keep the product only if it is in the category.
      if (!ids.some((pid) => String(pid) === String(filter.product))) return { items: [], total: 0 };
    } else {
      filter.product = { $in: ids };
    }
  }

  if (lowStock) {
    const all = await withPopulate(Inventory.find(filter)).sort(sort || '-updatedAt');
    const filtered = all.filter((inv) => inv.product && inv.available <= (inv.product.minStock || 0));
    const total = filtered.length;
    const start = (page - 1) * limit;
    return { items: filtered.slice(start, start + limit), total };
  }

  const [items, total] = await Promise.all([
    withPopulate(Inventory.find(filter))
      .sort(sort || '-updatedAt')
      .skip((page - 1) * limit)
      .limit(limit),
    Inventory.countDocuments(filter),
  ]);
  return { items, total };
}

/** GET /inventory/low-stock — every record where available <= product.minStock. */
async function lowStock(user) {
  const rows = await withPopulate(Inventory.find({ company: user.company }));
  return rows.filter((r) => r.product && r.available <= (r.product.minStock || 0));
}

/**
 * POST /inventory/adjust — apply a signed delta to a single field of the
 * (product, location) record (upserting the record if missing), clamping at >= 0.
 * Writes an audit entry and emits real-time updates.
 */
async function adjust(user, body, ip) {
  const { product, locationType, field, delta, note } = body;
  const locationId = locationType === 'warehouse' ? body.warehouse : body.store;

  // Validate the referenced product & location belong to this company.
  const productDoc = await Product.findOne({ _id: product, company: user.company });
  if (!productDoc) throw ApiError.notFound('Product not found');

  if (locationType === 'warehouse') {
    const wh = await Warehouse.findOne({ _id: locationId, company: user.company });
    if (!wh) throw ApiError.notFound('Warehouse not found');
  } else {
    const st = await Store.findOne({ _id: locationId, company: user.company });
    if (!st) throw ApiError.notFound('Store not found');
  }

  // Find or create the inventory record for this (product, location).
  const locFilter = locationType === 'warehouse' ? { warehouse: locationId } : { store: locationId };
  let inv = await Inventory.findOne({ company: user.company, product, ...locFilter });
  const isNew = !inv;
  if (!inv) {
    inv = new Inventory({
      company: user.company,
      product,
      locationType,
      warehouse: locationType === 'warehouse' ? locationId : null,
      store: locationType === 'store' ? locationId : null,
    });
  }

  // Read-modify-write so we can clamp at zero correctly (reject rather than clamp).
  const before = isNew ? null : inv.toObject();
  const next = (inv[field] || 0) + delta;
  if (next < 0) {
    throw ApiError.badRequest(`Adjustment would drive ${field} below zero (current ${inv[field] || 0}, delta ${delta})`);
  }
  inv[field] = next;
  inv.updatedBy = user.id;
  await inv.save();

  await writeAudit({
    company: user.company,
    actor: user.id,
    action: 'inventory.adjust',
    entity: 'Inventory',
    entityId: inv._id,
    before,
    after: { ...inv.toObject(), note },
    ip,
  });

  // Real-time: inventory changed.
  emitToCompany(user.company, 'inventory:updated', inventoryEvent(inv, product));

  // Low-stock alert only makes sense when the sellable `available` count changed.
  if (field === 'available' && inv.available <= (productDoc.minStock || 0)) {
    const notification = await Notification.create({
      company: user.company,
      user: null, // broadcast to the whole company
      type: 'low_stock',
      title: 'Low stock alert',
      message: `${productDoc.name} (${productDoc.sku}) is low on stock`,
      level: inv.available <= 0 ? 'critical' : 'warning',
      meta: { productId: product, sku: productDoc.sku, location: locationId, locationType },
    });
    emitToCompany(user.company, 'notification:new', { notification });
  }

  // Always hint dashboards to refetch KPIs.
  emitToCompany(user.company, 'dashboard:update', {});

  await inv.populate('product', PRODUCT_FIELDS);
  return inv;
}

module.exports = { list, lowStock, adjust };
