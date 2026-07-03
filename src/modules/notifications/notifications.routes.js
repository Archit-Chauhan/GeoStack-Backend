'use strict';
const express = require('express');
const ctrl = require('./notifications.controller');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const asyncHandler = require('../../utils/asyncHandler');
const schema = require('./notifications.validation');
const { PERMISSIONS: P } = require('../../constants/roles');

const router = express.Router();
router.use(authenticate);
router.use(authorize(P.NOTIFICATIONS_READ));

router.get('/', validate(schema.list), asyncHandler(ctrl.list));
router.post('/:id/read', validate(schema.idParam), asyncHandler(ctrl.markRead));
router.post('/read-all', asyncHandler(ctrl.markAllRead));

module.exports = router;
