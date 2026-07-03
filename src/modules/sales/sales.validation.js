'use strict';
const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const STATUSES = ['completed', 'returned', 'cancelled'];

const item = z.object({
  product: objectId,
  quantity: z.coerce.number().int().min(1),
});

/** POST /sales — totals are always recomputed server-side; client totals are ignored. */
const create = {
  body: z.object({
    store: objectId,
    items: z.array(item).min(1, 'At least one item is required'),
    tax: z.coerce.number().min(0).default(0),
    customer: z.object({ name: z.string().max(120).optional() }).optional(),
  }),
};

/** GET /sales */
const list = {
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sort: z.string().optional(),
    store: objectId.optional(),
    status: z.enum(STATUSES).optional(),
  }),
};

const idParam = { params: z.object({ id: objectId }) };

module.exports = { create, list, idParam };
