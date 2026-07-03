'use strict';
const express = require('express');
const ctrl = require('./products.controller');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const asyncHandler = require('../../utils/asyncHandler');
const schema = require('./products.validation');
const { PERMISSIONS: P } = require('../../constants/roles');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize(P.PRODUCTS_READ), validate(schema.list), asyncHandler(ctrl.list));
router.post('/', authorize(P.PRODUCTS_CREATE), validate(schema.create), asyncHandler(ctrl.create));
router.get('/:id', authorize(P.PRODUCTS_READ), validate(schema.idParam), asyncHandler(ctrl.getOne));
router.patch('/:id', authorize(P.PRODUCTS_UPDATE), validate(schema.update), asyncHandler(ctrl.update));
router.delete('/:id', authorize(P.PRODUCTS_DELETE), validate(schema.idParam), asyncHandler(ctrl.remove));

module.exports = router;
