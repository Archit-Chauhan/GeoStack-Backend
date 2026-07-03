'use strict';
const Sale = require('../../models/Sale');
const Inventory = require('../../models/Inventory');
const Product = require('../../models/Product');
const Store = require('../../models/Store');
const Notification = require('../../models/Notification');
const ApiError = require('../../utils/ApiError');
const { writeAudit } = require('../../utils/audit');
const { genCode } = require('../../utils/code');
const { emitToCompany } = require('../../socket');

/** Chain the standard populate set onto a Sale query. */
function withPopulate(query) {
  return query
    .populate('store', 'name code')
    .populate('items.product', 'name sku')
    .populate('cashier', 'name');
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

/** Emit a low_stock notification if a store record dropped to/below minStock. */
async function maybeLowStock(company, inv, product, store) {
  if (inv.available > (product.minStock || 0)) return;
  const notification = await Notification.create({
    company,
    user: null,
    type: 'low_stock',
    title: 'Low stock alert',
    message: `${product.name} (${product.sku}) is low on stock`,
    level: inv.available <= 0 ? 'critical' : 'warning',
    meta: { productId: product._id, sku: product.sku, location: store, locationType: 'store' },
  });
  emitToCompany(company, 'notification:new', { notification });
}

/* ---- Read endpoints -------------------------------------------------------- */
async function list(user, query) {
  const { page, limit, sort, store, status } = query;
  const filter = { company: user.company };
  if (store) filter.store = store;
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    withPopulate(Sale.find(filter))
      .sort(sort || '-createdAt')
      .skip((page - 1) * limit)
      .limit(limit),
    Sale.countDocuments(filter),
  ]);
  return { items, total };
}

async function getById(user, id) {
  const sale = await withPopulate(Sale.findOne({ _id: id, company: user.company }));
  if (!sale) throw ApiError.notFound('Sale not found');
  return sale;
}

/* ---- Create ---------------------------------------------------------------- */
/**
 * POST /sales — validates store stock for every line, reduces `available`,
 * recomputes totals server-side, writes audit, and emits real-time events.
 * Lines are de-duplicated per product so the same product listed twice cannot
 * over-sell a single inventory record.
 */
async function create(user, body, ip) {
  const { store, items, customer } = body;
  const tax = body.tax || 0;

  const storeDoc = await Store.findOne({ _id: store, company: user.company });
  if (!storeDoc) throw ApiError.notFound('Store not found');

  // Resolve each product once and accumulate the required quantity per product.
  const perProduct = new Map(); // productId -> { inv, product, required }
  const lineItems = [];
  for (const it of items) {
    const key = String(it.product);
    let entry = perProduct.get(key);
    if (!entry) {
      const product = await Product.findOne({ _id: it.product, company: user.company });
      if (!product) throw ApiError.notFound('Product not found');
      const inv = await Inventory.findOne({ company: user.company, product: it.product, store });
      entry = { inv, product, required: 0 };
      perProduct.set(key, entry);
    }
    entry.required += it.quantity;
    lineItems.push({ product: entry.product._id, quantity: it.quantity, unitPrice: entry.product.price });
  }

  // Validate stock for every product before mutating anything.
  for (const entry of perProduct.values()) {
    const have = entry.inv ? entry.inv.available : 0;
    if (!entry.inv || have < entry.required) {
      throw ApiError.badRequest(`Insufficient stock for ${entry.product.name} (need ${entry.required}, have ${have})`);
    }
  }

  // Reduce available stock now that all lines are known-good.
  for (const entry of perProduct.values()) {
    entry.inv.available -= entry.required;
    entry.inv.updatedBy = user.id;
    await entry.inv.save();
  }

  // Server-side totals — never trust client-provided totals.
  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const total = subtotal + tax;

  const sale = await Sale.create({
    company: user.company,
    code: genCode('SL'),
    store,
    items: lineItems,
    subtotal,
    tax,
    total,
    status: 'completed',
    cashier: user.id,
    customer: { name: customer?.name || 'Walk-in' },
  });

  await writeAudit({
    company: user.company,
    actor: user.id,
    action: 'sale.create',
    entity: 'Sale',
    entityId: sale._id,
    after: sale.toObject(),
    ip,
  });

  const populated = await getById(user, sale._id);
  emitToCompany(user.company, 'sale:created', { sale: populated });

  // Per-product inventory events + low-stock checks.
  for (const entry of perProduct.values()) {
    emitToCompany(user.company, 'inventory:updated', inventoryEvent(entry.inv, entry.product._id));
    await maybeLowStock(user.company, entry.inv, entry.product, store);
  }

  emitToCompany(user.company, 'dashboard:update', {});
  return populated;
}

/* ---- Refund ---------------------------------------------------------------- */
/** POST /sales/:id/refund — completed → returned; add each line back to store stock. */
async function refund(user, id, ip) {
  const sale = await Sale.findOne({ _id: id, company: user.company });
  if (!sale) throw ApiError.notFound('Sale not found');
  if (sale.status !== 'completed') throw ApiError.badRequest('Only completed sales can be refunded');

  const before = sale.toObject();
  sale.status = 'returned';
  await sale.save();

  // Return each item's quantity to the store's available stock.
  const events = [];
  for (const item of sale.items) {
    let inv = await Inventory.findOne({ company: user.company, product: item.product, store: sale.store });
    if (!inv) {
      inv = new Inventory({
        company: user.company,
        product: item.product,
        locationType: 'store',
        store: sale.store,
        warehouse: null,
      });
    }
    inv.available += item.quantity;
    inv.updatedBy = user.id;
    await inv.save();
    events.push(inventoryEvent(inv, item.product));
  }

  await writeAudit({
    company: user.company,
    actor: user.id,
    action: 'sale.refund',
    entity: 'Sale',
    entityId: sale._id,
    before,
    after: sale.toObject(),
    ip,
  });

  for (const ev of events) emitToCompany(user.company, 'inventory:updated', ev);
  emitToCompany(user.company, 'dashboard:update', {});

  return getById(user, sale._id);
}

module.exports = { list, getById, create, refund };
