'use strict';
const mongoose = require('mongoose');
const Sale = require('../../models/Sale');
const Inventory = require('../../models/Inventory');
const Transfer = require('../../models/Transfer');
const Warehouse = require('../../models/Warehouse');
const Store = require('../../models/Store');
const Product = require('../../models/Product');

const ACTIVE_TRANSFER_STATUSES = ['requested', 'approved', 'dispatched', 'in_transit', 'delivered'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

function pctChange(current, previous) {
  if (previous > 0) return Math.round(((current - previous) / previous) * 1000) / 10;
  return current > 0 ? 100 : 0;
}

async function sumRevenue(company, start, end) {
  const agg = await Sale.aggregate([
    { $match: { company, status: 'completed', createdAt: { $gte: start, $lt: end } } },
    { $group: { _id: null, total: { $sum: '$total' } } },
  ]);
  return agg[0]?.total || 0;
}

/**
 * KPI snapshot for the dashboard. Field names match the client `KPIs` type:
 * revenueMTD, revenueDeltaPct, inventoryValue, totalUnits, activeTransfers,
 * transfersAwaitingApproval, lowStockCount, criticalCount, plus counts.
 * (Delta fields without a historical baseline are returned as 0.)
 */
async function overview(user) {
  const company = toObjectId(user.company);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    revenueMTD,
    revenuePrev,
    inventoryAgg,
    activeTransfers,
    awaitingApproval,
    warehouseCount,
    storeCount,
    productCount,
  ] = await Promise.all([
    sumRevenue(company, startOfMonth, startOfNextMonth),
    sumRevenue(company, startOfPrevMonth, startOfMonth),
    Inventory.aggregate([
      { $match: { company } },
      { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      {
        $group: {
          _id: null,
          inventoryValue: { $sum: { $multiply: ['$available', '$product.price'] } },
          totalUnits: { $sum: '$available' },
          lowStock: { $sum: { $cond: [{ $lte: ['$available', '$product.minStock'] }, 1, 0] } },
          critical: { $sum: { $cond: [{ $lte: ['$available', 0] }, 1, 0] } },
        },
      },
    ]),
    Transfer.countDocuments({ company, status: { $in: ACTIVE_TRANSFER_STATUSES } }),
    Transfer.countDocuments({ company, status: 'requested' }),
    Warehouse.countDocuments({ company }),
    Store.countDocuments({ company }),
    Product.countDocuments({ company }),
  ]);

  const inv = inventoryAgg[0] || {};
  return {
    revenueMTD,
    revenueDeltaPct: pctChange(revenueMTD, revenuePrev),
    inventoryValue: Math.round((inv.inventoryValue || 0) * 100) / 100,
    inventoryDeltaPct: 0,
    totalUnits: inv.totalUnits || 0,
    activeTransfers,
    transfersAwaitingApproval: awaitingApproval,
    transfersDelta: 0,
    lowStockCount: inv.lowStock || 0,
    criticalCount: inv.critical || 0,
    lowStockDelta: 0,
    warehouseCount,
    storeCount,
    productCount,
  };
}

/**
 * Daily dispatched/received counts over the last `days` days (from Transfer.timeline).
 * Emits { date, label, dispatched, received } per the client `ThroughputPoint` type.
 */
async function throughput(user, days = 7) {
  const company = toObjectId(user.company);

  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const rows = await Transfer.aggregate([
    { $match: { company } },
    { $unwind: '$timeline' },
    {
      $match: {
        'timeline.status': { $in: ['dispatched', 'received'] },
        'timeline.at': { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: '%Y-%m-%d', date: '$timeline.at' } },
          status: '$timeline.status',
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const byDay = {};
  for (const row of rows) {
    const day = row._id.day;
    if (!byDay[day]) byDay[day] = { dispatched: 0, received: 0 };
    byDay[day][row._id.status] = row.count;
  }

  const result = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const date = d.toISOString().slice(0, 10);
    const counts = byDay[date] || { dispatched: 0, received: 0 };
    result.push({ date, label: WEEKDAYS[d.getDay()], dispatched: counts.dispatched, received: counts.received });
  }
  return result;
}

/** Units on hand grouped by product category. Emits { category, units, pct, percent }. */
async function stockByCategory(user) {
  const company = toObjectId(user.company);

  const rows = await Inventory.aggregate([
    { $match: { company } },
    { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $group: { _id: '$product.category', units: { $sum: '$available' } } },
    { $sort: { units: -1 } },
  ]);

  const totalUnits = rows.reduce((sum, r) => sum + r.units, 0);
  return rows.map((r) => {
    const pct = totalUnits > 0 ? Math.round((r.units / totalUnits) * 1000) / 10 : 0;
    return { category: r._id || 'General', units: r.units, pct, percent: pct };
  });
}

/** Inventory rows where available <= product.minStock, with product/location detail. */
async function lowStock(user) {
  const company = toObjectId(user.company);

  return Inventory.aggregate([
    { $match: { company } },
    { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $match: { $expr: { $lte: ['$available', '$product.minStock'] } } },
    { $lookup: { from: 'warehouses', localField: 'warehouse', foreignField: '_id', as: 'warehouse' } },
    { $lookup: { from: 'stores', localField: 'store', foreignField: '_id', as: 'store' } },
    { $unwind: { path: '$warehouse', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$store', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        available: 1,
        reserved: 1,
        incoming: 1,
        locationType: 1,
        'product._id': 1,
        'product.name': 1,
        'product.sku': 1,
        'product.minStock': 1,
        'warehouse._id': 1,
        'warehouse.name': 1,
        'store._id': 1,
        'store.name': 1,
      },
    },
    { $sort: { available: 1 } },
  ]);
}

/**
 * Top products by units sold across completed sales.
 * Emits { product:{name,sku}, productName, sku, unitsMoved, unitsSold } to satisfy
 * the client `FastMovingRow` type (unitsMoved/productName) plus the raw fields.
 */
async function fastMoving(user, limit = 5) {
  const company = toObjectId(user.company);

  const rows = await Sale.aggregate([
    { $match: { company, status: 'completed' } },
    { $unwind: '$items' },
    { $group: { _id: '$items.product', unitsSold: { $sum: '$items.quantity' } } },
    { $sort: { unitsSold: -1 } },
    { $limit: limit },
    { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    {
      $project: {
        _id: 0,
        product: { _id: '$product._id', name: '$product.name', sku: '$product.sku' },
        productName: '$product.name',
        sku: '$product.sku',
        unitsMoved: '$unitsSold',
        unitsSold: 1,
      },
    },
  ]);
  return rows;
}

module.exports = { overview, throughput, stockByCategory, lowStock, fastMoving };
