'use strict';
const express = require('express');
const ctrl = require('./warehouses.controller');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const asyncHandler = require('../../utils/asyncHandler');
const schema = require('./warehouses.validation');
const { PERMISSIONS: P } = require('../../constants/roles');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize(P.WAREHOUSES_READ), validate(schema.list), asyncHandler(ctrl.list));
router.post('/', authorize(P.WAREHOUSES_CREATE), validate(schema.create), asyncHandler(ctrl.create));
router.get('/:id', authorize(P.WAREHOUSES_READ), validate(schema.idParam), asyncHandler(ctrl.getOne));
router.get('/:id/summary', authorize(P.WAREHOUSES_READ), validate(schema.idParam), asyncHandler(ctrl.summary));
router.patch('/:id', authorize(P.WAREHOUSES_UPDATE), validate(schema.update), asyncHandler(ctrl.update));
router.delete('/:id', authorize(P.WAREHOUSES_DELETE), validate(schema.idParam), asyncHandler(ctrl.remove));

module.exports = router;
