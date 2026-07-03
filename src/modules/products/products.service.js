'use strict';
const Product = require('../../models/Product');
const Inventory = require('../../models/Inventory');
const ApiError = require('../../utils/ApiError');
const { writeAudit } = require('../../utils/audit');

/** Build company-scoped list results with pagination + optional text/category/status filters. */
async function list(user, query) {
  const { page, limit, q, category, status, sort } = query;
  const filter = { company: user.company };
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { sku: new RegExp(q, 'i') }];

  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort(sort || '-createdAt')
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
  ]);
  return { items, total };
}

async function getById(user, id) {
  const product = await Product.findOne({ _id: id, company: user.company });
  if (!product) throw ApiError.notFound('Product not found');
  return product;
}

async function create(user, data, ip) {
  const exists = await Product.findOne({ company: user.company, sku: (data.sku || '').toUpperCase() });
  if (exists) throw ApiError.conflict('A product with this SKU already exists');

  const product = await Product.create({ ...data, company: user.company });
  await writeAudit({
    company: user.company,
    actor: user.id,
    action: 'product.create',
    entity: 'Product',
    entityId: product._id,
    after: product.toObject(),
    ip,
  });
  return product;
}

async function update(user, id, data, ip) {
  const product = await Product.findOne({ _id: id, company: user.company });
  if (!product) throw ApiError.notFound('Product not found');

  const before = product.toObject();
  Object.assign(product, data);
  await product.save();

  await writeAudit({
    company: user.company,
    actor: user.id,
    action: 'product.update',
    entity: 'Product',
    entityId: product._id,
    before,
    after: product.toObject(),
    ip,
  });
  return product;
}

async function remove(user, id, ip) {
  const product = await Product.findOne({ _id: id, company: user.company });
  if (!product) throw ApiError.notFound('Product not found');

  const inUse = await Inventory.countDocuments({ product: id, available: { $gt: 0 } });
  if (inUse) throw ApiError.conflict('Cannot delete a product that still has stock on hand');

  await product.deleteOne();
  await writeAudit({
    company: user.company,
    actor: user.id,
    action: 'product.delete',
    entity: 'Product',
    entityId: id,
    before: product.toObject(),
    ip,
  });
  return { deleted: true };
}

module.exports = { list, getById, create, update, remove };
