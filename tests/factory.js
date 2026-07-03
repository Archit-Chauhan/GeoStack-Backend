'use strict';
const crypto = require('crypto');
const Company = require('../src/models/Company');
const User = require('../src/models/User');
const Warehouse = require('../src/models/Warehouse');
const Store = require('../src/models/Store');
const Product = require('../src/models/Product');
const { signAccessToken } = require('../src/utils/tokens');
const { ROLES } = require('../src/constants/roles');

const rnd = () => crypto.randomBytes(3).toString('hex');

async function makeCompany(name = 'Acme') {
  return Company.create({ name, slug: `${name.toLowerCase()}-${rnd()}` });
}

async function makeUser(company, role = ROLES.COMPANY_OWNER, extra = {}) {
  const passwordHash = await User.hashPassword('Test1234!');
  return User.create({
    company: company._id,
    name: `${role} user`,
    email: `${role}.${rnd()}@test.co`,
    passwordHash,
    role,
    ...extra,
  });
}

/** Returns { company, user, token } for a given role (defaults to owner = all perms). */
async function auth(role = ROLES.COMPANY_OWNER, extra = {}) {
  const company = await makeCompany();
  const user = await makeUser(company, role, extra);
  return { company, user, token: signAccessToken(user) };
}

async function makeWarehouse(company, over = {}) {
  return Warehouse.create({
    company: company._id,
    name: over.name || `WH ${rnd()}`,
    code: over.code || `W${rnd().toUpperCase()}`,
    location: over.location || { lat: 32.7767, lng: -96.797 },
    capacityPallets: over.capacityPallets ?? 1000,
    type: over.type || 'standard',
    ...over,
  });
}

async function makeStore(company, over = {}) {
  return Store.create({
    company: company._id,
    name: over.name || `ST ${rnd()}`,
    code: over.code || `S${rnd().toUpperCase()}`,
    location: over.location || { lat: 25.7617, lng: -80.1918 },
    ...over,
  });
}

async function makeProduct(company, over = {}) {
  return Product.create({
    company: company._id,
    name: over.name || `Product ${rnd()}`,
    sku: over.sku || `SKU-${rnd().toUpperCase()}`,
    category: over.category || 'General',
    price: over.price ?? 10,
    minStock: over.minStock ?? 5,
    ...over,
  });
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { makeCompany, makeUser, auth, makeWarehouse, makeStore, makeProduct, bearer };
