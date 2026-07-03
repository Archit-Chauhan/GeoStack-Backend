'use strict';
const express = require('express');
const ctrl = require('./users.controller');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const asyncHandler = require('../../utils/asyncHandler');
const schema = require('./users.validation');
const { PERMISSIONS: P } = require('../../constants/roles');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize(P.USERS_READ), validate(schema.list), asyncHandler(ctrl.list));
router.post('/invite', authorize(P.USERS_INVITE), validate(schema.invite), asyncHandler(ctrl.invite));
router.get('/:id', authorize(P.USERS_READ), validate(schema.idParam), asyncHandler(ctrl.getOne));
router.patch('/:id', authorize(P.USERS_UPDATE), validate(schema.update), asyncHandler(ctrl.update));
router.patch(
  '/:id/role',
  authorize(P.ROLES_ASSIGN),
  validate(schema.updateRole),
  asyncHandler(ctrl.updateRole)
);
router.delete('/:id', authorize(P.USERS_DELETE), validate(schema.idParam), asyncHandler(ctrl.remove));

module.exports = router;
