'use strict';
const { z } = require('zod');

const throughput = {
  query: z.object({
    days: z.coerce.number().min(1).max(90).default(7),
  }),
};

const fastMoving = {
  query: z.object({
    limit: z.coerce.number().min(1).max(50).default(5),
  }),
};

module.exports = { throughput, fastMoving };
