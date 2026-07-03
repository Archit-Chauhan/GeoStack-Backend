'use strict';
const Warehouse = require('../../models/Warehouse');
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
    Warehouse.find(filter)
      .populate('manager', 'name email role avatarColor')
      .sort(sort || '-createdAt')
      .skip((page - 1) * limit)
      .limit(limit),
    Warehouse.countDocuments(filter),
  ]);
  return { items, total };
}

async function getById(user, id) {
  const warehouse = await Warehouse.findOne({ _id: id, company: user.company }).populate(
    'manager',
    'name email role avatarColor'
  );
  if (!warehouse) throw ApiError.notFound('Warehouse not found');
  return warehouse;
}

async function create(user, data, ip) {
  const exists = await Warehouse.findOne({ company: user.company, code: (data.code || '').toUpperCase() });
  if (exists) throw ApiError.conflict('A warehouse with this code already exists');

  const warehouse = await Warehouse.create({ ...data, company: user.company });
  await writeAudit({
    company: user.company,
    actor: user.id,
    action: 'warehouse.create',
    entity: 'Warehouse',
    entityId: warehouse._id,
    after: warehouse.toObject(),
    ip,
  });
  return warehouse;
}

async function update(user, id, data, ip) {
  const warehouse = await Warehouse.findOne({ _id: id, company: user.company });
  if (!warehouse) throw ApiError.notFound('Warehouse not found');

  const before = warehouse.toObject();
  Object.assign(warehouse, data);
  await warehouse.save();

  await writeAudit({
    company: user.company,
    actor: user.id,
    action: 'warehouse.update',
    entity: 'Warehouse',
    entityId: warehouse._id,
    before,
    after: warehouse.toObject(),
    ip,
  });
  return warehouse;
}

async function remove(user, id, ip) {
  const warehouse = await Warehouse.findOne({ _id: id, company: user.company });
  if (!warehouse) throw ApiError.notFound('Warehouse not found');

  const inUse = await Inventory.countDocuments({ warehouse: id, available: { $gt: 0 } });
  if (inUse) throw ApiError.conflict('Cannot delete a warehouse that still holds stock');

  await warehouse.deleteOne();
  await writeAudit({
    company: user.company,
    actor: user.id,
    action: 'warehouse.delete',
    entity: 'Warehouse',
    entityId: id,
    before: warehouse.toObject(),
    ip,
  });
  return { deleted: true };
}

/** Rich summary used by the map marker popover. */
async function summary(user, id) {
  const warehouse = await getById(user, id);
  const rows = await Inventory.find({ warehouse: id }).populate('product', 'name sku minStock price');

  let onHand = 0;
  let stockValue = 0;
  let lowStock = 0;
  for (const r of rows) {
    onHand += r.available + r.reserved;
    stockValue += r.available * (r.product?.price || 0);
    if (r.product && r.available <= (r.product.minStock || 0)) lowStock += 1;
  }

  return {
    warehouse,
    metrics: {
      products: rows.length,
      onHand,
      stockValue: Math.round(stockValue),
      lowStock,
      utilization: warehouse.utilization,
    },
  };
}

module.exports = { list, getById, create, update, remove, summary };
