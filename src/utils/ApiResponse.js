'use strict';

/** Uniform success envelope: { success:true, data, message }. */
function ok(res, data = null, message = 'OK', status = 200) {
  return res.status(status).json({ success: true, message, data });
}

function created(res, data = null, message = 'Created') {
  return ok(res, data, message, 201);
}

/** Helper to shape paginated list payloads consistently. */
function paginate(items, { page, limit, total }) {
  return { items, page, limit, total, pages: Math.ceil(total / limit) || 1 };
}

module.exports = { ok, created, paginate };
