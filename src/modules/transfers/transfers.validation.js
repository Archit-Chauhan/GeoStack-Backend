'use strict';
const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const LOCATION_TYPES = ['warehouse', 'store'];
const STATUSES = ['requested', 'approved', 'dispatched', 'in_transit', 'delivered', 'received', 'cancelled'];

const item = z.object({
  product: objectId,
  quantity: z.coerce.number().int().min(1),
});

/** POST /transfers */
const create = {
  body: z.object({
    fromType: z.enum(LOCATION_TYPES),
    from: objectId,
    toType: z.enum(LOCATION_TYPES),
    to: objectId,
    items: z.array(item).min(1, 'At least one item is required'),
    notes: z.string().max(1000).optional(),
  }),
};

/** GET /transfers */
const list = {
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sort: z.string().optional(),
    status: z.enum(STATUSES).optional(),
    fromType: z.enum(LOCATION_TYPES).optional(),
    toType: z.enum(LOCATION_TYPES).optional(),
  }),
};

const idParam = { params: z.object({ id: objectId }) };

/** Body shape shared by every state-transition endpoint (approve/dispatch/…/cancel). */
const action = {
  params: z.object({ id: objectId }),
  body: z.object({ note: z.string().max(1000).optional() }).default({}),
};

module.exports = { create, list, idParam, action };
