'use strict';
const Store = require('../../models/Store');
const Inventory = require('../../models/Inventory');
const Product = require('../../models/Product');
const ApiError = require('../../utils/ApiError');
const { writeAudit } = require('../../utils/audit');

/** Build company-scoped list results with pagination + optional text/status filters. */
async function list(user, query) {
  const { page, limit, q, status, sort } = query;
  const filter = { company: user.company };
  if (status) filter.status = status;
  if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { code: new RegExp(q, 'i') }];

  const [items, total] = await Promise.all([
    Store.find(filter)
      .populate('manager', 'name email role avatarColor')
      .sort(sort || '-createdAt')
      .skip((page - 1) * limit)
      .limit(limit),
    Store.countDocuments(filter),
  ]);
  return { items, total };
}

async function getById(user, id) {
  const store = await Store.findOne({ _id: id, company: user.company }).populate(
    'manager',
    'name email role avatarColor'
  );
  if (!store) throw ApiError.notFound('Store not found');
  return store;
}

async function create(user, data, ip) {
  const exists = await Store.findOne({ company: user.company, code: (data.code || '').toUpperCase() });
  if (exists) throw ApiError.conflict('A store with this code already exists');

  const store = await Store.create({ ...data, company: user.company });
  await writeAudit({
    company: user.company,
    actor: user.id,
    action: 'store.create',
    entity: 'Store',
    entityId: store._id,
    after: store.toObject(),
    ip,
  });
  return store;
}

async function update(user, id, data, ip) {
  const store = await Store.findOne({ _id: id, company: user.company });
  if (!store) throw ApiError.notFound('Store not found');

  const before = store.toObject();
  Object.assign(store, data);
  await store.save();

  await writeAudit({
    company: user.company,
    actor: user.id,
    action: 'store.update',
    entity: 'Store',
    entityId: store._id,
    before,
    after: store.toObject(),
    ip,
  });
  return store;
}

async function remove(user, id, ip) {
  const store = await Store.findOne({ _id: id, company: user.company });
  if (!store) throw ApiError.notFound('Store not found');

  const inUse = await Inventory.countDocuments({ store: id, available: { $gt: 0 } });
  if (inUse) throw ApiError.conflict('Cannot delete a store that still holds stock');

  await store.deleteOne();
  await writeAudit({
    company: user.company,
    actor: user.id,
    action: 'store.delete',
    entity: 'Store',
    entityId: id,
    before: store.toObject(),
    ip,
  });
  return { deleted: true };
}

/** Rich summary used by the map marker popover. */
async function summary(user, id) {
  const store = await getById(user, id);
  const rows = await Inventory.find({ store: id }).populate('product', 'name sku minStock price');

  let onHand = 0;
  let stockValue = 0;
  let lowStock = 0;
  for (const r of rows) {
    onHand += r.available + r.reserved;
    stockValue += r.available * (r.product?.price || 0);
    if (r.product && r.available <= (r.product.minStock || 0)) lowStock += 1;
  }

  return {
    store,
    metrics: {
      products: rows.length,
      onHand,
      stockValue: Math.round(stockValue),
      lowStock,
    },
  };
}

module.exports = { list, getById, create, update, remove, summary };
