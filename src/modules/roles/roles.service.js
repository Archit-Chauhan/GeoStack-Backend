'use strict';
const { ROLES, ROLE_HIERARCHY, ALL_PERMISSIONS, permissionsForRole } = require('../../constants/roles');

/** company_owner -> "Company Owner" */
function titleCase(key) {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function list() {
  const roles = Object.values(ROLES).map((key) => ({
    key,
    label: titleCase(key),
    level: ROLE_HIERARCHY[key] || 0,
    permissions: permissionsForRole(key),
  }));
  return { roles, permissions: ALL_PERMISSIONS };
}

module.exports = { list };
