'use strict';
const crypto = require('crypto');
const User = require('../../models/User');
const Company = require('../../models/Company');
const ApiError = require('../../utils/ApiError');
const { writeAudit } = require('../../utils/audit');
const { ALL_ROLES, ROLE_HIERARCHY, ROLES } = require('../../constants/roles');
const config = require('../../config');

/** Build company-scoped list results with pagination + name/email/role/status filters. */
async function list(user, query) {
  const { page, limit, q, role, status, sort } = query;
  const filter = { company: user.company };
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }];

  const [items, total] = await Promise.all([
    User.find(filter)
      .populate('warehouse', 'name code')
      .populate('store', 'name code')
      .sort(sort || '-createdAt')
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);
  return { items, total };
}

async function getById(user, id) {
  const found = await User.findOne({ _id: id, company: user.company })
    .populate('warehouse', 'name code')
    .populate('store', 'name code');
  if (!found) throw ApiError.notFound('User not found');
  return found;
}

/** Generates a random, sufficiently-complex temporary password for invited users. */
function genPassword() {
  const rand = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x');
  return `Gs${rand}7`;
}

async function invite(user, data, ip) {
  const email = data.email.toLowerCase();
  if (await User.exists({ email })) throw ApiError.conflict('A user with this email already exists');

  let tempPassword;
  let plainPassword = data.password;
  if (!plainPassword) {
    plainPassword = genPassword();
    tempPassword = plainPassword;
  }

  const passwordHash = await User.hashPassword(plainPassword);
  const newUser = await User.create({
    company: user.company,
    name: data.name,
    email,
    passwordHash,
    role: data.role,
    warehouse: data.warehouse || null,
    store: data.store || null,
    status: data.password ? 'active' : 'invited',
  });

  await writeAudit({
    company: user.company,
    actor: user.id,
    action: 'user.invite',
    entity: 'User',
    entityId: newUser._id,
    after: newUser.toObject(),
    ip,
  });

  const result = newUser.toJSON();
  if (tempPassword && !config.isProd) {
    return { ...result, tempPassword };
  }
  return result;
}

async function update(user, id, data, ip) {
  const found = await User.findOne({ _id: id, company: user.company });
  if (!found) throw ApiError.notFound('User not found');

  const before = found.toObject();
  const allowed = ['name', 'phone', 'status', 'warehouse', 'store'];
  for (const key of allowed) {
    if (data[key] !== undefined) found[key] = data[key];
  }
  await found.save();

  await writeAudit({
    company: user.company,
    actor: user.id,
    action: 'user.update',
    entity: 'User',
    entityId: found._id,
    before,
    after: found.toObject(),
    ip,
  });
  return found;
}

async function updateRole(user, id, role, ip) {
  if (!ALL_ROLES.includes(role)) throw ApiError.badRequest('Invalid role');

  const found = await User.findOne({ _id: id, company: user.company });
  if (!found) throw ApiError.notFound('User not found');

  const callerLevel = ROLE_HIERARCHY[user.role] || 0;
  const targetLevel = ROLE_HIERARCHY[role] || 0;
  if (user.role !== ROLES.COMPANY_OWNER && targetLevel >= callerLevel) {
    throw ApiError.forbidden('Cannot assign a role equal to or higher than your own');
  }

  const before = found.toObject();
  found.role = role;
  await found.save();

  await writeAudit({
    company: user.company,
    actor: user.id,
    action: 'user.role',
    entity: 'User',
    entityId: found._id,
    before,
    after: found.toObject(),
    ip,
  });
  return found;
}

async function remove(user, id, ip) {
  if (String(id) === String(user.id)) throw ApiError.badRequest('You cannot delete your own account');

  const found = await User.findOne({ _id: id, company: user.company });
  if (!found) throw ApiError.notFound('User not found');

  const company = await Company.findById(user.company);
  if (company && company.owner && String(company.owner) === String(found._id)) {
    throw ApiError.badRequest('Cannot delete the company owner');
  }

  const before = found.toObject();
  await found.deleteOne();

  await writeAudit({
    company: user.company,
    actor: user.id,
    action: 'user.delete',
    entity: 'User',
    entityId: id,
    before,
    ip,
  });
  return { deleted: true };
}

module.exports = { list, getById, invite, update, updateRole, remove };
