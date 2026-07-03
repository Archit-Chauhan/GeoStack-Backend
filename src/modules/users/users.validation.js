'use strict';
const { z } = require('zod');
const { ALL_ROLES } = require('../../constants/roles');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

const invite = {
  body: z.object({
    name: z.string().min(2).max(80),
    email: z.string().email(),
    role: z.enum(ALL_ROLES),
    warehouse: objectId.optional().nullable(),
    store: objectId.optional().nullable(),
    password: password.optional(),
  }),
};

const update = {
  params: z.object({ id: objectId }),
  body: z.object({
    name: z.string().min(2).max(80).optional(),
    phone: z.string().max(30).optional(),
    status: z.enum(['active', 'invited', 'disabled']).optional(),
    warehouse: objectId.optional().nullable(),
    store: objectId.optional().nullable(),
  }),
};

const updateRole = {
  params: z.object({ id: objectId }),
  body: z.object({ role: z.enum(ALL_ROLES) }),
};

const idParam = { params: z.object({ id: objectId }) };

const list = {
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    q: z.string().optional(),
    role: z.enum(ALL_ROLES).optional(),
    status: z.enum(['active', 'invited', 'disabled']).optional(),
    sort: z.string().optional(),
  }),
};

module.exports = { invite, update, updateRole, idParam, list };
