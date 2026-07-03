'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const ctrl = require('./auth.controller');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const schema = require('./auth.validation');
const asyncHandler = require('../../utils/asyncHandler');
const config = require('../../config');

const router = express.Router();

// Throttle credential endpoints (relaxed in test to avoid flaky 429s).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isTest ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, try again later' },
});

router.post('/register', authLimiter, validate(schema.register), asyncHandler(ctrl.register));
router.post('/login', authLimiter, validate(schema.login), asyncHandler(ctrl.login));
router.post('/refresh', asyncHandler(ctrl.refresh));
router.post('/logout', asyncHandler(ctrl.logout));
router.post('/forgot-password', authLimiter, validate(schema.forgotPassword), asyncHandler(ctrl.forgotPassword));
router.post('/reset-password', authLimiter, validate(schema.resetPassword), asyncHandler(ctrl.resetPassword));

router.get('/me', authenticate, asyncHandler(ctrl.me));
router.patch('/me', authenticate, validate(schema.updateMe), asyncHandler(ctrl.updateMe));

module.exports = router;
