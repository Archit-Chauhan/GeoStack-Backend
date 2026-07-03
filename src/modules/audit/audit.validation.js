'use strict';
const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const list = {
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    entity: z.string().optional(),
    entityId: objectId.optional(),
    actor: objectId.optional(),
    action: z.string().optional(),
    sort: z.string().optional(),
  }),
};

module.exports = { list };
