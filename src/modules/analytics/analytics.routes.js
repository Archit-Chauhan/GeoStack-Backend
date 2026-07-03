'use strict';
const express = require('express');
const ctrl = require('./analytics.controller');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const asyncHandler = require('../../utils/asyncHandler');
const schema = require('./analytics.validation');
const { PERMISSIONS: P } = require('../../constants/roles');

const router = express.Router();
router.use(authenticate);
router.use(authorize(P.ANALYTICS_READ));

router.get('/overview', asyncHandler(ctrl.overview));
router.get('/throughput', validate(schema.throughput), asyncHandler(ctrl.throughput));
router.get('/stock-by-category', asyncHandler(ctrl.stockByCategory));
router.get('/low-stock', asyncHandler(ctrl.lowStock));
router.get('/fast-moving', validate(schema.fastMoving), asyncHandler(ctrl.fastMoving));

module.exports = router;
