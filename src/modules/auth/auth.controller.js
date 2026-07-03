'use strict';
const service = require('./auth.service');
const config = require('../../config');
const { ok, created } = require('../../utils/ApiResponse');
const { ttlToDate } = require('../../utils/tokens');

const REFRESH_COOKIE = 'refreshToken';

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? 'none' : 'lax',
    expires: ttlToDate(config.jwt.refreshTtl),
    path: '/api/v1/auth',
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
}

async function register(req, res) {
  const { refreshToken, ...data } = await service.register(req.body, req.ip);
  setRefreshCookie(res, refreshToken);
  return created(res, data, 'Company registered');
}

async function login(req, res) {
  const { refreshToken, ...data } = await service.login(req.body.email, req.body.password, req.ip);
  setRefreshCookie(res, refreshToken);
  return ok(res, data, 'Signed in');
}

async function refresh(req, res) {
  const raw = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
  const { refreshToken, ...data } = await service.refresh(raw, req.ip);
  setRefreshCookie(res, refreshToken);
  return ok(res, data, 'Token refreshed');
}

async function logout(req, res) {
  const raw = req.cookies?.[REFRESH_COOKIE];
  await service.logout(raw);
  clearRefreshCookie(res);
  return ok(res, null, 'Signed out');
}

async function me(req, res) {
  return ok(res, await service.me(req.user.id));
}

async function updateMe(req, res) {
  return ok(res, await service.updateMe(req.user.id, req.body), 'Profile updated');
}

async function forgotPassword(req, res) {
  return ok(res, await service.forgotPassword(req.body.email), 'If the account exists, a reset link was sent');
}

async function resetPassword(req, res) {
  return ok(res, await service.resetPassword(req.body.token, req.body.password), 'Password reset');
}

module.exports = { register, login, refresh, logout, me, updateMe, forgotPassword, resetPassword };
