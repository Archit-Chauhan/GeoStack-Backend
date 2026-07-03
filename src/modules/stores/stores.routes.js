'use strict';
const express = require('express');
const ctrl = require('./stores.controller');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const asyncHandler = require('../../utils/asyncHandler');
const schema = require('./stores.validation');
const { PERMISSIONS: P } = require('../../constants/roles');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize(P.STORES_READ), validate(schema.list), asyncHandler(ctrl.list));
router.post('/', authorize(P.STORES_CREATE), validate(schema.create), asyncHandler(ctrl.create));
router.get('/:id', authorize(P.STORES_READ), validate(schema.idParam), asyncHandler(ctrl.getOne));
router.get('/:id/summary', authorize(P.STORES_READ), validate(schema.idParam), asyncHandler(ctrl.summary));
router.patch('/:id', authorize(P.STORES_UPDATE), validate(schema.update), asyncHandler(ctrl.update));
router.delete('/:id', authorize(P.STORES_DELETE), validate(schema.idParam), asyncHandler(ctrl.remove));

module.exports = router;
