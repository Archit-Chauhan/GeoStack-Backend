'use strict';
const express = require('express');
const ctrl = require('./transfers.controller');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const asyncHandler = require('../../utils/asyncHandler');
const schema = require('./transfers.validation');
const { PERMISSIONS: P } = require('../../constants/roles');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize(P.TRANSFERS_READ), validate(schema.list), asyncHandler(ctrl.list));
router.post('/', authorize(P.TRANSFERS_CREATE), validate(schema.create), asyncHandler(ctrl.create));
router.get('/:id', authorize(P.TRANSFERS_READ), validate(schema.idParam), asyncHandler(ctrl.getOne));

router.post('/:id/approve', authorize(P.TRANSFERS_APPROVE), validate(schema.action), asyncHandler(ctrl.approve));
router.post('/:id/dispatch', authorize(P.TRANSFERS_DISPATCH), validate(schema.action), asyncHandler(ctrl.dispatch));
router.post('/:id/in-transit', authorize(P.TRANSFERS_DISPATCH), validate(schema.action), asyncHandler(ctrl.inTransit));
router.post('/:id/deliver', authorize(P.TRANSFERS_RECEIVE), validate(schema.action), asyncHandler(ctrl.deliver));
router.post('/:id/receive', authorize(P.TRANSFERS_RECEIVE), validate(schema.action), asyncHandler(ctrl.receive));
router.post('/:id/cancel', authorize(P.TRANSFERS_CANCEL), validate(schema.action), asyncHandler(ctrl.cancel));

module.exports = router;
