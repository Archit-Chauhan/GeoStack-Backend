'use strict';
const express = require('express');
const ctrl = require('./inventory.controller');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const asyncHandler = require('../../utils/asyncHandler');
const schema = require('./inventory.validation');
const { PERMISSIONS: P } = require('../../constants/roles');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize(P.INVENTORY_READ), validate(schema.list), asyncHandler(ctrl.list));
router.get('/low-stock', authorize(P.INVENTORY_READ), asyncHandler(ctrl.lowStock));
router.post('/adjust', authorize(P.INVENTORY_ADJUST), validate(schema.adjust), asyncHandler(ctrl.adjust));

module.exports = router;
