'use strict';
const Transfer = require('../../models/Transfer');
const Inventory = require('../../models/Inventory');
const Product = require('../../models/Product');
const Warehouse = require('../../models/Warehouse');
const Store = require('../../models/Store');
const Notification = require('../../models/Notification');
const ApiError = require('../../utils/ApiError');
const { writeAudit } = require('../../utils/audit');
const { haversineKm, etaHours } = require('../../utils/geo');
const { genCode } = require('../../utils/code');
const { emitToCompany } = require('../../socket');

/* ---- State machine -------------------------------------------------------- */
/* Allowed forward transitions. cancelled is only reachable from the two early
 * states, which is what keeps "cancel only from requested/approved" honest. */
const TRANSITIONS = {
  requested: ['approved', 'cancelled'],
  approved: ['dispatched', 'cancelled'],
  dispatched: ['in_transit'],
  in_transit: ['delivered'],
  delivered: ['received'],
  received: [],
  cancelled: [],
};

/** Guard: throw 400 unless `current → next` is a permitted transition. */
function assertTransition(current, next) {
  const allowed = TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    throw ApiError.badRequest(`Cannot move a transfer from '${current}' to '${next}'`);
  }
}

/* ---- Populate helpers ------------------------------------------------------ */
function populateList(query) {
  return query
    .populate('from', 'name code')
    .populate('to', 'name code')
    .populate('items.product', 'name sku')
    .populate('requestedBy', 'name')
    .populate('approvedBy', 'name');
}

function populateDetail(query) {
  return populateList(query).populate('timeline.by', 'name');
}

/* ---- Location + inventory helpers ----------------------------------------- */
/** Load a warehouse/store (company-scoped) and return its lat/lng-bearing doc. */
async function loadLocation(user, type, id) {
  const Model = type === 'warehouse' ? Warehouse : Store;
  const doc = await Model.findOne({ _id: id, company: user.company });
  if (!doc) throw ApiError.notFound(`${type === 'warehouse' ? 'Warehouse' : 'Store'} not found`);
  return doc;
}

/** Find-or-create the inventory record for a (locationType, location, product). */
async function getOrCreateInv(company, locationType, locationId, product) {
  const locFilter = locationType === 'warehouse' ? { warehouse: locationId } : { store: locationId };
  let inv = await Inventory.findOne({ company, product, ...locFilter });
  if (!inv) {
    inv = new Inventory({
      company,
      product,
      locationType,
      warehouse: locationType === 'warehouse' ? locationId : null,
      store: locationType === 'store' ? locationId : null,
    });
  }
  return inv;
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

/* ---- Read endpoints -------------------------------------------------------- */
async function list(user, query) {
  const { page, limit, sort, status, fromType, toType } = query;
  const filter = { company: user.company };
  if (status) filter.status = status;
  if (fromType) filter.fromType = fromType;
  if (toType) filter.toType = toType;

  const [items, total] = await Promise.all([
    populateList(Transfer.find(filter))
      .sort(sort || '-createdAt')
      .skip((page - 1) * limit)
      .limit(limit),
    Transfer.countDocuments(filter),
  ]);
  return { items, total };
}

async function getById(user, id) {
  const transfer = await populateDetail(Transfer.findOne({ _id: id, company: user.company }));
  if (!transfer) throw ApiError.notFound('Transfer not found');
  return transfer;
}

/* ---- Create ---------------------------------------------------------------- */
async function create(user, body, ip) {
  const { fromType, from, toType, to, items, notes } = body;

  // Validate both endpoints belong to the company and grab their coordinates.
  const fromLoc = await loadLocation(user, fromType, from);
  const toLoc = await loadLocation(user, toType, to);

  // Validate every product belongs to the company.
  const productIds = [...new Set(items.map((i) => String(i.product)))];
  const productCount = await Product.countDocuments({ _id: { $in: productIds }, company: user.company });
  if (productCount !== productIds.length) throw ApiError.badRequest('One or more products are invalid');

  const distanceKm = haversineKm(fromLoc.location, toLoc.location);
  const eta = etaHours(distanceKm);
  const code = genCode('TR');

  const transfer = await Transfer.create({
    company: user.company,
    code,
    fromType,
    from,
    toType,
    to,
    items: items.map((i) => ({ product: i.product, quantity: i.quantity })),
    status: 'requested',
    requestedBy: user.id,
    timeline: [{ status: 'requested', by: user.id, at: new Date(), note: notes || undefined }],
    distanceKm,
    etaHours: eta,
    notes,
  });

  await writeAudit({
    company: user.company,
    actor: user.id,
    action: 'transfer.create',
    entity: 'Transfer',
    entityId: transfer._id,
    after: transfer.toObject(),
    ip,
  });

  const notification = await Notification.create({
    company: user.company,
    user: null,
    type: 'transfer_request',
    title: 'New transfer request',
    message: `Transfer ${code} requested (${items.length} item${items.length === 1 ? '' : 's'})`,
    level: 'info',
    meta: { transferId: transfer._id, code, fromType, toType },
  });

  const populated = await getById(user, transfer._id);
  emitToCompany(user.company, 'transfer:created', { transfer: populated });
  emitToCompany(user.company, 'notification:new', { notification });
  emitToCompany(user.company, 'dashboard:update', {});
  return populated;
}

/* ---- Generic transition core ---------------------------------------------- */
/**
 * Runs one state transition end-to-end:
 *   1. load + company-scope, 2. guard the transition, 3. optional inventory side
 *   effects (may throw → aborts before any state change), 4. append timeline +
 *   save, 5. audit, 6. transfer_update notification, 7. emit sockets.
 * `opts.onInventory(transfer, events)` mutates/saves inventory and pushes socket
 * payloads onto `events`. `opts.message` labels the notification.
 */
async function advance(user, id, nextStatus, ip, note, opts = {}) {
  const transfer = await Transfer.findOne({ _id: id, company: user.company });
  if (!transfer) throw ApiError.notFound('Transfer not found');

  assertTransition(transfer.status, nextStatus);
  const before = transfer.toObject();

  // Inventory side effects happen before the status flips so a failure (e.g.
  // insufficient stock on dispatch) leaves the transfer untouched.
  const events = [];
  if (opts.onInventory) await opts.onInventory(transfer, events);

  if (nextStatus === 'approved') transfer.approvedBy = user.id;

  const timelineEntry = { status: nextStatus, by: user.id, note: note || undefined, at: new Date() };
  transfer.timeline.push(timelineEntry);
  transfer.status = nextStatus;
  await transfer.save();

  await writeAudit({
    company: user.company,
    actor: user.id,
    action: `transfer.${nextStatus}`,
    entity: 'Transfer',
    entityId: transfer._id,
    before,
    after: transfer.toObject(),
    ip,
  });

  const notification = await Notification.create({
    company: user.company,
    user: null,
    type: 'transfer_update',
    title: `Transfer ${transfer.code} ${nextStatus.replace('_', ' ')}`,
    message: opts.message || `Transfer ${transfer.code} is now ${nextStatus.replace('_', ' ')}`,
    level: nextStatus === 'cancelled' ? 'warning' : 'info',
    meta: { transferId: transfer._id, code: transfer.code, status: nextStatus },
  });

  // Emit inventory changes (if any) first, then the transfer + notification.
  for (const ev of events) emitToCompany(user.company, 'inventory:updated', ev);
  emitToCompany(user.company, 'transfer:updated', { transferId: transfer._id, status: nextStatus, timelineEntry });
  emitToCompany(user.company, 'notification:new', { notification });
  emitToCompany(user.company, 'dashboard:update', {});

  return getById(user, id);
}

/* ---- Transition endpoints -------------------------------------------------- */
async function approve(user, id, ip, note) {
  return advance(user, id, 'approved', ip, note, { message: 'Transfer approved' });
}

/** dispatched: source available↓ / outgoing↑, destination incoming↑. */
async function dispatch(user, id, ip, note) {
  return advance(user, id, 'dispatched', ip, note, {
    message: 'Transfer dispatched from source',
    onInventory: async (transfer, events) => {
      for (const item of transfer.items) {
        const src = await getOrCreateInv(transfer.company, transfer.fromType, transfer.from, item.product);
        if (src.available < item.quantity) {
          throw ApiError.badRequest(
            `Insufficient stock at source to dispatch (need ${item.quantity}, have ${src.available})`
          );
        }
        src.available -= item.quantity;
        src.outgoing += item.quantity;
        src.updatedBy = user.id;
        await src.save();
        events.push(inventoryEvent(src, item.product));

        const dest = await getOrCreateInv(transfer.company, transfer.toType, transfer.to, item.product);
        dest.incoming += item.quantity;
        dest.updatedBy = user.id;
        await dest.save();
        events.push(inventoryEvent(dest, item.product));
      }
    },
  });
}

async function inTransit(user, id, ip, note) {
  return advance(user, id, 'in_transit', ip, note, { message: 'Transfer is in transit' });
}

async function deliver(user, id, ip, note) {
  return advance(user, id, 'delivered', ip, note, { message: 'Transfer delivered to destination' });
}

/** received: destination incoming↓ / available↑, source outgoing↓ (clamped). */
async function receive(user, id, ip, note) {
  return advance(user, id, 'received', ip, note, {
    message: 'Transfer received into destination stock',
    onInventory: async (transfer, events) => {
      for (const item of transfer.items) {
        const dest = await getOrCreateInv(transfer.company, transfer.toType, transfer.to, item.product);
        dest.incoming = Math.max(0, dest.incoming - item.quantity);
        dest.available += item.quantity;
        dest.updatedBy = user.id;
        await dest.save();
        events.push(inventoryEvent(dest, item.product));

        const src = await getOrCreateInv(transfer.company, transfer.fromType, transfer.from, item.product);
        src.outgoing = Math.max(0, src.outgoing - item.quantity);
        src.updatedBy = user.id;
        await src.save();
        events.push(inventoryEvent(src, item.product));
      }
    },
  });
}

/** cancel: only reachable from requested/approved (enforced by the guard). No inventory effects. */
async function cancel(user, id, ip, note) {
  return advance(user, id, 'cancelled', ip, note, { message: 'Transfer cancelled' });
}

module.exports = {
  list,
  getById,
  create,
  approve,
  dispatch,
  inTransit,
  deliver,
  receive,
  cancel,
};
