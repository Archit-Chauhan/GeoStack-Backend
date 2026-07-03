'use strict';
const { z } = require('zod');

/* Mongo ObjectId shape used across the module. */
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const FIELDS = ['available', 'reserved', 'incoming', 'outgoing', 'damaged'];
const LOCATION_TYPES = ['warehouse', 'store'];

/** GET /inventory — company-scoped, paginated list with optional filters. */
const list = {
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sort: z.string().optional(),
    warehouse: objectId.optional(),
    store: objectId.optional(),
    product: objectId.optional(),
    category: z.string().optional(),
    locationType: z.enum(LOCATION_TYPES).optional(),
    // ?lowStock=true — coerce the query string safely (z.coerce.boolean turns
    // the string "false" into true, so match explicitly instead).
    lowStock: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true'),
  }),
};

/** POST /inventory/adjust — signed delta on a single field of one (product, location) record. */
const adjust = {
  body: z
    .object({
      product: objectId,
      locationType: z.enum(LOCATION_TYPES),
      warehouse: objectId.optional(),
      store: objectId.optional(),
      field: z.enum(FIELDS),
      delta: z.coerce.number(),
      note: z.string().max(500).optional(),
    })
    // The location id must match the chosen locationType.
    .refine((d) => (d.locationType === 'warehouse' ? !!d.warehouse : !!d.store), {
      message: 'A matching warehouse (or store) id is required for the given locationType',
      path: ['warehouse'],
    }),
};

module.exports = { list, adjust };
