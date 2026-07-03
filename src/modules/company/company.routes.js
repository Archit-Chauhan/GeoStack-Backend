'use strict';
const express = require('express');
const ctrl = require('./company.controller');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const asyncHandler = require('../../utils/asyncHandler');
const schema = require('./company.validation');
const { PERMISSIONS: P } = require('../../constants/roles');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize(P.COMPANY_READ), asyncHandler(ctrl.getCompany));
router.patch('/', authorize(P.COMPANY_UPDATE), validate(schema.update), asyncHandler(ctrl.updateCompany));

module.exports = router;
