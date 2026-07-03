'use strict';
const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const location = z
  .object({
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    address: z.string().max(200).optional(),
    city: z.string().max(80).optional(),
    country: z.string().max(80).optional(),
  })
  .optional();

const create = {
  body: z.object({
    name: z.string().min(2).max(100),
    code: z.string().min(1).max(20),
    manager: objectId.optional().nullable(),
    location,
    capacityPallets: z.coerce.number().min(0).optional(),
    type: z.enum(['standard', 'cold', 'hub']).optional(),
    status: z.enum(['active', 'inactive']).optional(),
  }),
};

const update = {
  params: z.object({ id: objectId }),
  body: create.body.partial(),
};

const idParam = { params: z.object({ id: objectId }) };

const list = {
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    q: z.string().optional(),
    status: z.enum(['active', 'inactive']).optional(),
    sort: z.string().optional(),
  }),
};

module.exports = { create, update, idParam, list };
