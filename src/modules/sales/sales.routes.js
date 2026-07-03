'use strict';
const express = require('express');
const ctrl = require('./sales.controller');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const asyncHandler = require('../../utils/asyncHandler');
const schema = require('./sales.validation');
const { PERMISSIONS: P } = require('../../constants/roles');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize(P.SALES_READ), validate(schema.list), asyncHandler(ctrl.list));
router.post('/', authorize(P.SALES_CREATE), validate(schema.create), asyncHandler(ctrl.create));
router.get('/:id', authorize(P.SALES_READ), validate(schema.idParam), asyncHandler(ctrl.getOne));
router.post('/:id/refund', authorize(P.SALES_REFUND), validate(schema.idParam), asyncHandler(ctrl.refund));

module.exports = router;
