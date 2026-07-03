'use strict';
const { z } = require('zod');

const address = z
  .object({
    line1: z.string().max(200).optional(),
    city: z.string().max(80).optional(),
    state: z.string().max(80).optional(),
    country: z.string().max(80).optional(),
    zip: z.string().max(20).optional(),
  })
  .optional();

const settings = z
  .object({
    lowStockThresholdDefault: z.coerce.number().min(0).optional(),
  })
  .optional();

const update = {
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    industry: z.string().max(60).optional(),
    currency: z.string().max(8).optional(),
    address,
    settings,
  }),
};

module.exports = { update };
