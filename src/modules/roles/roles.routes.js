'use strict';
const express = require('express');
const ctrl = require('./roles.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const asyncHandler = require('../../utils/asyncHandler');
const { PERMISSIONS: P } = require('../../constants/roles');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize(P.ROLES_READ), asyncHandler(ctrl.list));

module.exports = router;
