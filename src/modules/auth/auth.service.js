'use strict';
const crypto = require('crypto');
const Company = require('../../models/Company');
const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');
const ApiError = require('../../utils/ApiError');
const config = require('../../config');
const { ROLES } = require('../../constants/roles');
const {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  ttlToDate,
} = require('../../utils/tokens');

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

async function uniqueSlug(name) {
  const base = slugify(name) || 'company';
  let slug = base;
  // Append a short suffix until unique.
  // eslint-disable-next-line no-await-in-loop
  while (await Company.exists({ slug })) {
    slug = `${base}-${crypto.randomBytes(2).toString('hex')}`;
  }
  return slug;
}

async function issueTokens(user, ip) {
  const accessToken = signAccessToken(user);
  const { token, tokenHash } = generateRefreshToken();
  await RefreshToken.create({
    user: user._id,
    tokenHash,
    expiresAt: ttlToDate(config.jwt.refreshTtl),
    createdByIp: ip,
  });
  return { accessToken, refreshToken: token };
}

async function register(payload, ip) {
  const email = payload.email.toLowerCase();
  if (await User.exists({ email })) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const company = await Company.create({
    name: payload.companyName,
    slug: await uniqueSlug(payload.companyName),
    industry: payload.industry || 'General',
    currency: payload.currency || 'USD',
  });

  const passwordHash = await User.hashPassword(payload.password);
  const user = await User.create({
    company: company._id,
    name: payload.name,
    email,
    passwordHash,
    role: ROLES.COMPANY_OWNER,
    status: 'active',
  });

  company.owner = user._id;
  await company.save();

  const tokens = await issueTokens(user, ip);
  return { user: user.toJSON(), company: company.toJSON(), ...tokens };
}

async function login(email, plainPassword, ip) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) throw ApiError.unauthorized('Invalid email or password');
  if (user.status === 'disabled') throw ApiError.forbidden('Account disabled');

  const match = await user.comparePassword(plainPassword);
  if (!match) throw ApiError.unauthorized('Invalid email or password');

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueTokens(user, ip);
  return { user: user.toJSON(), ...tokens };
}

async function refresh(rawToken, ip) {
  if (!rawToken) throw ApiError.unauthorized('Missing refresh token');
  const tokenHash = hashToken(rawToken);
  const existing = await RefreshToken.findOne({ tokenHash, revoked: false });
  if (!existing || existing.expiresAt < new Date()) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findById(existing.user);
  if (!user || user.status === 'disabled') throw ApiError.unauthorized('Account unavailable');

  // Rotate: revoke the used token, issue a fresh pair.
  existing.revoked = true;
  await existing.save();
  const tokens = await issueTokens(user, ip);
  return { user: user.toJSON(), ...tokens };
}

async function logout(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await RefreshToken.updateOne({ tokenHash }, { revoked: true });
}

async function me(userId) {
  const user = await User.findById(userId).populate('company', 'name slug currency');
  if (!user) throw ApiError.notFound('User not found');
  return user.toJSON();
}

async function updateMe(userId, data) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.notFound('User not found');

  if (data.newPassword) {
    const okCurrent = await user.comparePassword(data.currentPassword || '');
    if (!okCurrent) throw ApiError.badRequest('Current password is incorrect');
    user.passwordHash = await User.hashPassword(data.newPassword);
  }
  if (data.name !== undefined) user.name = data.name;
  if (data.phone !== undefined) user.phone = data.phone;
  if (data.avatarColor !== undefined) user.avatarColor = data.avatarColor;
  await user.save();
  return user.toJSON();
}

async function forgotPassword(email) {
  const user = await User.findOne({ email: email.toLowerCase() });
  // Always resolve (don't leak which emails exist).
  if (!user) return { sent: true };

  const rawToken = crypto.randomBytes(32).toString('hex');
  user.resetTokenHash = hashToken(rawToken);
  user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h
  await user.save();

  // No SMTP configured → return token in non-prod so the flow is testable.
  return { sent: true, resetToken: config.isProd ? undefined : rawToken };
}

async function resetPassword(rawToken, newPassword) {
  const tokenHash = hashToken(rawToken);
  const user = await User.findOne({
    resetTokenHash: tokenHash,
    resetTokenExpires: { $gt: new Date() },
  }).select('+passwordHash +resetTokenHash +resetTokenExpires');
  if (!user) throw ApiError.badRequest('Invalid or expired reset token');

  user.passwordHash = await User.hashPassword(newPassword);
  user.resetTokenHash = undefined;
  user.resetTokenExpires = undefined;
  await user.save();
  // Revoke all refresh tokens on password reset.
  await RefreshToken.updateMany({ user: user._id }, { revoked: true });
  return { reset: true };
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  updateMe,
  forgotPassword,
  resetPassword,
};
