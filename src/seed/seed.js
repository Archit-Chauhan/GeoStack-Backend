'use strict';
/**
 * Demo data seed for GeoStock.
 * Run with: node src/seed/seed.js  (or `npm run seed`)
 *
 * Wipes every collection touched below, then rebuilds a small but realistic
 * multi-warehouse / multi-store company so the frontend has something to render.
 */
const { connectDB, disconnectDB } = require('../db/connect');
const { ROLES } = require('../constants/roles');
const { genCode } = require('../utils/code');
const { haversineKm, etaHours } = require('../utils/geo');

const Company = require('../models/Company');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const Warehouse = require('../models/Warehouse');
const Store = require('../models/Store');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const Transfer = require('../models/Transfer');
const Sale = require('../models/Sale');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');

const DEMO_PASSWORD = 'Demo1234!';

const PRODUCT_DEFS = [
  { name: 'Acetaminophen 500mg', sku: 'SKU-PH-40921', category: 'Pharma', brand: 'MedRelief', price: 6.99, cost: 3.1, minStock: 200, maxStock: 3000 },
  { name: 'Ibuprofen 200mg', sku: 'SKU-PH-40933', category: 'Pharma', brand: 'MedRelief', price: 5.49, cost: 2.6, minStock: 150, maxStock: 2500 },
  { name: 'Vitamin C 1000mg', sku: 'SKU-PH-40950', category: 'Pharma', brand: 'VitaCore', price: 8.99, cost: 4.0, minStock: 140, maxStock: 2000 },
  { name: 'Organic Oat Milk 1L', sku: 'SKU-GR-11002', category: 'Grocery', brand: 'PureHarvest', price: 4.29, cost: 2.1, minStock: 100, maxStock: 1800 },
  { name: 'Sparkling Water 12-pack', sku: 'SKU-GR-11015', category: 'Grocery', brand: 'AquaFizz', price: 6.49, cost: 3.2, minStock: 150, maxStock: 2200 },
  { name: 'Extra Virgin Olive Oil 500ml', sku: 'SKU-GR-11028', category: 'Grocery', brand: 'Mediterra', price: 9.99, cost: 5.5, minStock: 100, maxStock: 1200 },
  { name: 'Cotton Tee — Black', sku: 'SKU-AP-22004', category: 'Apparel', brand: 'Everwear', price: 14.99, cost: 6.0, minStock: 100, maxStock: 1500 },
  { name: 'Cotton Tee — White', sku: 'SKU-AP-22005', category: 'Apparel', brand: 'Everwear', price: 14.99, cost: 6.0, minStock: 100, maxStock: 1500 },
  { name: 'Running Shoes — 42', sku: 'SKU-AP-22040', category: 'Apparel', brand: 'Stridewell', price: 79.99, cost: 38.0, minStock: 120, maxStock: 700 },
  { name: 'Steel Water Bottle 750ml', sku: 'SKU-HG-33010', category: 'Homegoods', brand: 'Hearthline', price: 19.99, cost: 8.5, minStock: 100, maxStock: 1000 },
  { name: 'Ceramic Mug Set (4pc)', sku: 'SKU-HG-33022', category: 'Homegoods', brand: 'Hearthline', price: 24.99, cost: 11.0, minStock: 110, maxStock: 800 },
  { name: 'Bamboo Cutting Board', sku: 'SKU-HG-33035', category: 'Homegoods', brand: 'Hearthline', price: 17.99, cost: 7.75, minStock: 110, maxStock: 650 },
];

// (product sku, location code) pairs that are deliberately pushed at/below minStock
// so low-stock analytics + notifications have real data to show.
const LOW_STOCK_COMBOS = new Set([
  'SKU-PH-40921|DAL',
  'SKU-PH-40933|NWK',
  'SKU-HG-33010|FRS',
  'SKU-AP-22040|MIA',
  'SKU-GR-11028|DEN',
]);

const WAREHOUSE_FACTOR = { DAL: 0.55, NWK: 0.65, FRS: 0.35 };
const STORE_FACTOR = { MIA: 0.08, DEN: 0.05 };

function daysAgo(n, hoursOffset = 0) {
  return new Date(Date.now() - n * 864e5 + hoursOffset * 36e5);
}

/** Builds ordered timeline entries, spaced a few hours apart, ending at `status`. */
function buildTimeline(statuses, actorId, startDaysAgo) {
  return statuses.map((status, i) => ({
    status,
    at: daysAgo(startDaysAgo, i * 6),
    by: actorId,
  }));
}

async function wipe() {
  await Promise.all([
    Company.deleteMany({}),
    User.deleteMany({}),
    RefreshToken.deleteMany({}),
    Warehouse.deleteMany({}),
    Store.deleteMany({}),
    Product.deleteMany({}),
    Inventory.deleteMany({}),
    Transfer.deleteMany({}),
    Sale.deleteMany({}),
    Notification.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
}

async function main() {
  try {
    await connectDB();
    console.log('[seed] Connected. Wiping existing collections...');
    await wipe();

    /* ---------------- Company + Users ---------------- */
    const company = await Company.create({
      name: 'Northwind Supply Co.',
      slug: 'northwind',
      currency: 'USD',
      industry: 'Wholesale Distribution & Retail',
      address: { line1: '100 Commerce St', city: 'Dallas', state: 'TX', country: 'USA', zip: '75201' },
    });

    const passwordHash = await User.hashPassword(DEMO_PASSWORD);

    const ownerUser = await User.create({
      company: company._id,
      name: 'Archit Chauhan',
      email: 'owner@northwind.co',
      passwordHash,
      role: ROLES.COMPANY_OWNER,
      status: 'active',
    });

    const managerUser = await User.create({
      company: company._id,
      name: 'Miguel Torres',
      email: 'manager@northwind.co',
      passwordHash,
      role: ROLES.WAREHOUSE_MANAGER,
      status: 'active',
    });

    const storeManagerUser = await User.create({
      company: company._id,
      name: 'Priya Nandan',
      email: 'store@northwind.co',
      passwordHash,
      role: ROLES.STORE_MANAGER,
      status: 'active',
    });

    const cashierUser = await User.create({
      company: company._id,
      name: 'Jordan Lee',
      email: 'cashier@northwind.co',
      passwordHash,
      role: ROLES.CASHIER,
      status: 'active',
    });

    const analystUser = await User.create({
      company: company._id,
      name: 'Sam Okafor',
      email: 'analyst@northwind.co',
      passwordHash,
      role: ROLES.ANALYST,
      status: 'active',
    });

    company.owner = ownerUser._id;
    await company.save();

    /* ---------------- Warehouses + Stores ---------------- */
    const dallas = await Warehouse.create({
      company: company._id,
      name: 'Dallas DC',
      code: 'DAL',
      type: 'standard',
      manager: managerUser._id,
      location: { lat: 32.7767, lng: -96.797, address: '2323 Trade Fair Dr', city: 'Dallas', country: 'USA' },
      capacityPallets: 40000,
      usedPallets: 34000,
      status: 'active',
    });

    const newark = await Warehouse.create({
      company: company._id,
      name: 'Newark Hub',
      code: 'NWK',
      type: 'hub',
      location: { lat: 40.7357, lng: -74.1724, address: '1 Logistics Pkwy', city: 'Newark', country: 'USA' },
      capacityPallets: 60000,
      usedPallets: 43000,
      status: 'active',
    });

    const fresno = await Warehouse.create({
      company: company._id,
      name: 'Fresno Cold-Store',
      code: 'FRS',
      type: 'cold',
      location: { lat: 36.7378, lng: -119.7871, address: '900 Chill Way', city: 'Fresno', country: 'USA' },
      capacityPallets: 18000,
      usedPallets: 11000,
      status: 'active',
    });

    const miami = await Store.create({
      company: company._id,
      name: 'Miami Retail',
      code: 'MIA',
      manager: storeManagerUser._id,
      location: { lat: 25.7617, lng: -80.1918, address: '1200 Biscayne Blvd', city: 'Miami', country: 'USA' },
      status: 'active',
    });

    const denver = await Store.create({
      company: company._id,
      name: 'Denver Store',
      code: 'DEN',
      location: { lat: 39.7392, lng: -104.9903, address: '500 16th St Mall', city: 'Denver', country: 'USA' },
      status: 'active',
    });

    managerUser.warehouse = dallas._id;
    await managerUser.save();
    storeManagerUser.store = miami._id;
    await storeManagerUser.save();
    cashierUser.store = miami._id;
    await cashierUser.save();

    /* ---------------- Products ---------------- */
    const products = await Product.insertMany(
      PRODUCT_DEFS.map((p) => ({ ...p, company: company._id, unit: 'unit', status: 'active' }))
    );
    const bySku = Object.fromEntries(products.map((p) => [p.sku, p]));

    /* ---------------- Inventory ---------------- */
    const warehouses = [dallas, newark, fresno];
    const stores = [miami, denver];
    const inventoryDocs = [];

    for (const wh of warehouses) {
      products.forEach((p, idx) => {
        const key = `${p.sku}|${wh.code}`;
        let available = Math.round(p.maxStock * WAREHOUSE_FACTOR[wh.code] * (0.85 + 0.03 * (idx % 5)));
        let reserved = Math.round(available * 0.05);
        let incoming = Math.round(p.maxStock * 0.06);
        if (LOW_STOCK_COMBOS.has(key)) {
          available = Math.max(0, Math.round(p.minStock * 0.6));
          reserved = Math.round(available * 0.1);
          incoming = Math.round(p.minStock * 0.4);
        }
        inventoryDocs.push({
          company: company._id,
          product: p._id,
          locationType: 'warehouse',
          warehouse: wh._id,
          available,
          reserved,
          incoming,
          outgoing: 0,
          damaged: Math.round(available * 0.01),
          updatedBy: ownerUser._id,
        });
      });
    }

    for (const st of stores) {
      products.forEach((p, idx) => {
        const key = `${p.sku}|${st.code}`;
        let available = Math.max(5, Math.round(p.maxStock * STORE_FACTOR[st.code] * (0.8 + 0.05 * (idx % 4))));
        let reserved = Math.round(available * 0.1);
        let incoming = Math.round(available * 0.15);
        if (LOW_STOCK_COMBOS.has(key)) {
          available = Math.max(0, Math.round(p.minStock * 0.5));
          reserved = 0;
          incoming = Math.round(p.minStock * 0.3);
        }
        inventoryDocs.push({
          company: company._id,
          product: p._id,
          locationType: 'store',
          store: st._id,
          available,
          reserved,
          incoming,
          outgoing: 0,
          damaged: 0,
          updatedBy: ownerUser._id,
        });
      });
    }

    await Inventory.insertMany(inventoryDocs);

    /* ---------------- Transfers ---------------- */
    // 1) Dallas -> Newark, in transit
    const t1Distance = haversineKm(dallas.location, newark.location);
    const transfer1 = await Transfer.create({
      company: company._id,
      code: genCode('TR'),
      fromType: 'warehouse',
      from: dallas._id,
      toType: 'warehouse',
      to: newark._id,
      items: [
        { product: bySku['SKU-PH-40921']._id, quantity: 500 },
        { product: bySku['SKU-GR-11002']._id, quantity: 300 },
      ],
      status: 'in_transit',
      requestedBy: ownerUser._id,
      approvedBy: ownerUser._id,
      timeline: buildTimeline(['requested', 'approved', 'dispatched', 'in_transit'], ownerUser._id, 3),
      distanceKm: t1Distance,
      etaHours: etaHours(t1Distance),
      notes: 'Restocking Newark ahead of a regional demand spike.',
    });

    // 2) Newark -> Miami, dispatched
    const t2Distance = haversineKm(newark.location, miami.location);
    const transfer2 = await Transfer.create({
      company: company._id,
      code: genCode('TR'),
      fromType: 'warehouse',
      from: newark._id,
      toType: 'store',
      to: miami._id,
      items: [
        { product: bySku['SKU-AP-22004']._id, quantity: 150 },
        { product: bySku['SKU-AP-22040']._id, quantity: 40 },
      ],
      status: 'dispatched',
      requestedBy: ownerUser._id,
      approvedBy: ownerUser._id,
      timeline: buildTimeline(['requested', 'approved', 'dispatched'], ownerUser._id, 1),
      distanceKm: t2Distance,
      etaHours: etaHours(t2Distance),
      notes: 'Apparel replenishment for Miami Retail.',
    });

    // 3) Fresno -> Denver, approved
    const t3Distance = haversineKm(fresno.location, denver.location);
    const transfer3 = await Transfer.create({
      company: company._id,
      code: genCode('TR'),
      fromType: 'warehouse',
      from: fresno._id,
      toType: 'store',
      to: denver._id,
      items: [{ product: bySku['SKU-GR-11028']._id, quantity: 100 }],
      status: 'approved',
      requestedBy: ownerUser._id,
      approvedBy: ownerUser._id,
      timeline: buildTimeline(['requested', 'approved'], ownerUser._id, 0.5),
      distanceKm: t3Distance,
      etaHours: etaHours(t3Distance),
      notes: 'Cold-chain grocery order for Denver Store.',
    });

    /* ---------------- Sales ---------------- */
    const sale1Items = [
      { product: bySku['SKU-AP-22004']._id, quantity: 3, unitPrice: bySku['SKU-AP-22004'].price },
      { product: bySku['SKU-HG-33010']._id, quantity: 2, unitPrice: bySku['SKU-HG-33010'].price },
    ];
    const sale1Subtotal = Math.round(sale1Items.reduce((s, i) => s + i.quantity * i.unitPrice, 0) * 100) / 100;
    const sale1Tax = Math.round(sale1Subtotal * 0.07 * 100) / 100;

    await Sale.create({
      company: company._id,
      code: genCode('SL'),
      store: miami._id,
      items: sale1Items,
      subtotal: sale1Subtotal,
      tax: sale1Tax,
      total: Math.round((sale1Subtotal + sale1Tax) * 100) / 100,
      status: 'completed',
      cashier: cashierUser._id,
      customer: { name: 'Walk-in' },
    });

    const sale2Items = [
      { product: bySku['SKU-PH-40921']._id, quantity: 5, unitPrice: bySku['SKU-PH-40921'].price },
      { product: bySku['SKU-AP-22040']._id, quantity: 1, unitPrice: bySku['SKU-AP-22040'].price },
    ];
    const sale2Subtotal = Math.round(sale2Items.reduce((s, i) => s + i.quantity * i.unitPrice, 0) * 100) / 100;
    const sale2Tax = Math.round(sale2Subtotal * 0.07 * 100) / 100;

    await Sale.create({
      company: company._id,
      code: genCode('SL'),
      store: miami._id,
      items: sale2Items,
      subtotal: sale2Subtotal,
      tax: sale2Tax,
      total: Math.round((sale2Subtotal + sale2Tax) * 100) / 100,
      status: 'completed',
      cashier: cashierUser._id,
      customer: { name: 'Elena Cruz' },
    });

    /* ---------------- Notifications ---------------- */
    await Notification.insertMany([
      {
        company: company._id,
        user: null,
        type: 'low_stock',
        title: 'Low stock: Acetaminophen 500mg',
        message: 'Dallas DC available stock has fallen to or below the minimum threshold of 200 units.',
        level: 'warning',
        read: false,
        meta: { sku: 'SKU-PH-40921', warehouseId: dallas._id, warehouseName: dallas.name },
      },
      {
        company: company._id,
        user: managerUser._id,
        type: 'transfer_update',
        title: `Transfer ${transfer2.code} dispatched`,
        message: `Newark Hub → Miami Retail transfer is on its way (ETA ${transfer2.etaHours}h).`,
        level: 'info',
        read: false,
        meta: { transferId: transfer2._id, transferCode: transfer2.code },
      },
    ]);

    /* ---------------- Summary ---------------- */
    console.log('\n================ GeoStock demo seed complete ================');
    console.log(`Company:        ${company.name} (${company.slug})`);
    console.log('Users:          5');
    console.log('Warehouses:     3 (Dallas DC, Newark Hub, Fresno Cold-Store)');
    console.log('Stores:         2 (Miami Retail, Denver Store)');
    console.log(`Products:       ${products.length}`);
    console.log(`Inventory rows: ${inventoryDocs.length}`);
    console.log(`Transfers:      3 (${transfer1.code} in_transit, ${transfer2.code} dispatched, ${transfer3.code} approved)`);
    console.log('Sales:          2 (completed, Miami Retail)');
    console.log('Notifications:  2 (low_stock, transfer_update)');
    console.log('\nLogin credentials (all passwords: Demo1234!):');
    console.log('  owner@northwind.co     -- company_owner       (Archit Chauhan)');
    console.log('  manager@northwind.co   -- warehouse_manager   (Dallas DC)');
    console.log('  store@northwind.co     -- store_manager       (Miami Retail)');
    console.log('  cashier@northwind.co   -- cashier              (Miami Retail)');
    console.log('  analyst@northwind.co   -- analyst');
    console.log('===============================================================\n');

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('[seed] Failed:', err);
    process.exit(1);
  }
}

main();
