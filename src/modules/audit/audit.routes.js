'use strict';
const express = require('express');
const ctrl = require('./audit.controller');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const asyncHandler = require('../../utils/asyncHandler');
const schema = require('./audit.validation');
const { PERMISSIONS: P } = require('../../constants/roles');

const router = express.Router();
router.use(authenticate);
router.use(authorize(P.AUDIT_READ));

router.get('/', validate(schema.list), asyncHandler(ctrl.list));

module.exports = router;
