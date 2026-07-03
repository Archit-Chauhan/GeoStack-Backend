'use strict';
const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const list = {
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    // Query strings are always strings, so plain z.coerce.boolean() would treat
    // "false" as truthy — normalize explicitly instead.
    unread: z.preprocess((v) => (v === undefined ? undefined : v === 'true' || v === true), z.boolean().optional()),
  }),
};

const idParam = { params: z.object({ id: objectId }) };

module.exports = { list, idParam };
