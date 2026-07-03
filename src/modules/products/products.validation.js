'use strict';
const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const create = {
  body: z.object({
    name: z.string().min(2).max(150),
    sku: z.string().min(1).max(40),
    category: z.string().max(80).optional(),
    brand: z.string().max(80).optional(),
    unit: z.string().max(20).optional(),
    images: z.array(z.string()).optional(),
    minStock: z.coerce.number().min(0).optional(),
    maxStock: z.coerce.number().min(0).optional(),
    price: z.coerce.number().min(0).optional(),
    cost: z.coerce.number().min(0).optional(),
    status: z.enum(['active', 'archived']).optional(),
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
    category: z.string().optional(),
    status: z.enum(['active', 'archived']).optional(),
    sort: z.string().optional(),
  }),
};

module.exports = { create, update, idParam, list };
