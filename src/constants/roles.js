'use strict';

/* ---- Roles ---- */
const ROLES = {
  COMPANY_OWNER: 'company_owner',
  COMPANY_ADMIN: 'company_admin',
  WAREHOUSE_MANAGER: 'warehouse_manager',
  WAREHOUSE_STAFF: 'warehouse_staff',
  WAREHOUSE_HELPER: 'warehouse_helper',
  STORE_MANAGER: 'store_manager',
  CASHIER: 'cashier',
  STORE_HELPER: 'store_helper',
  ANALYST: 'analyst',
};

const ALL_ROLES = Object.values(ROLES);

/* Higher number = more authority (used for "can this user manage that user"). */
const ROLE_HIERARCHY = {
  [ROLES.COMPANY_OWNER]: 100,
  [ROLES.COMPANY_ADMIN]: 90,
  [ROLES.WAREHOUSE_MANAGER]: 70,
  [ROLES.STORE_MANAGER]: 70,
  [ROLES.WAREHOUSE_STAFF]: 50,
  [ROLES.CASHIER]: 50,
  [ROLES.WAREHOUSE_HELPER]: 30,
  [ROLES.STORE_HELPER]: 30,
  [ROLES.ANALYST]: 10,
};

/* ---- Permissions (resource:action) ---- */
const PERMISSIONS = {
  COMPANY_READ: 'company:read',
  COMPANY_UPDATE: 'company:update',
  USERS_READ: 'users:read',
  USERS_INVITE: 'users:invite',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  ROLES_READ: 'roles:read',
  ROLES_ASSIGN: 'roles:assign',
  WAREHOUSES_READ: 'warehouses:read',
  WAREHOUSES_CREATE: 'warehouses:create',
  WAREHOUSES_UPDATE: 'warehouses:update',
  WAREHOUSES_DELETE: 'warehouses:delete',
  STORES_READ: 'stores:read',
  STORES_CREATE: 'stores:create',
  STORES_UPDATE: 'stores:update',
  STORES_DELETE: 'stores:delete',
  PRODUCTS_READ: 'products:read',
  PRODUCTS_CREATE: 'products:create',
  PRODUCTS_UPDATE: 'products:update',
  PRODUCTS_DELETE: 'products:delete',
  INVENTORY_READ: 'inventory:read',
  INVENTORY_UPDATE: 'inventory:update',
  INVENTORY_ADJUST: 'inventory:adjust',
  TRANSFERS_READ: 'transfers:read',
  TRANSFERS_CREATE: 'transfers:create',
  TRANSFERS_APPROVE: 'transfers:approve',
  TRANSFERS_DISPATCH: 'transfers:dispatch',
  TRANSFERS_RECEIVE: 'transfers:receive',
  TRANSFERS_CANCEL: 'transfers:cancel',
  SALES_READ: 'sales:read',
  SALES_CREATE: 'sales:create',
  SALES_REFUND: 'sales:refund',
  ANALYTICS_READ: 'analytics:read',
  NOTIFICATIONS_READ: 'notifications:read',
  NOTIFICATIONS_MANAGE: 'notifications:manage',
  AUDIT_READ: 'audit:read',
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS);
const READ_PERMISSIONS = ALL_PERMISSIONS.filter((p) => p.endsWith(':read'));

const P = PERMISSIONS;

/* ---- Role → permissions ---- */
const ROLE_PERMISSIONS = {
  // Full control
  [ROLES.COMPANY_OWNER]: ALL_PERMISSIONS,
  [ROLES.COMPANY_ADMIN]: ALL_PERMISSIONS,

  // Read-only across the board
  [ROLES.ANALYST]: [...READ_PERMISSIONS, P.ANALYTICS_READ, P.AUDIT_READ],

  // Warehouse side
  [ROLES.WAREHOUSE_MANAGER]: [
    P.COMPANY_READ, P.WAREHOUSES_READ, P.WAREHOUSES_UPDATE, P.STORES_READ,
    P.PRODUCTS_READ, P.INVENTORY_READ, P.INVENTORY_UPDATE, P.INVENTORY_ADJUST,
    P.TRANSFERS_READ, P.TRANSFERS_CREATE, P.TRANSFERS_APPROVE, P.TRANSFERS_DISPATCH,
    P.TRANSFERS_RECEIVE, P.TRANSFERS_CANCEL, P.ANALYTICS_READ, P.NOTIFICATIONS_READ,
    P.USERS_READ,
  ],
  [ROLES.WAREHOUSE_STAFF]: [
    P.WAREHOUSES_READ, P.PRODUCTS_READ, P.INVENTORY_READ, P.INVENTORY_UPDATE,
    P.INVENTORY_ADJUST, P.TRANSFERS_READ, P.TRANSFERS_DISPATCH, P.TRANSFERS_RECEIVE,
    P.NOTIFICATIONS_READ,
  ],
  [ROLES.WAREHOUSE_HELPER]: [
    P.WAREHOUSES_READ, P.PRODUCTS_READ, P.INVENTORY_READ, P.TRANSFERS_READ,
    P.NOTIFICATIONS_READ,
  ],

  // Store side
  [ROLES.STORE_MANAGER]: [
    P.COMPANY_READ, P.STORES_READ, P.STORES_UPDATE, P.PRODUCTS_READ, P.INVENTORY_READ,
    P.TRANSFERS_READ, P.TRANSFERS_CREATE, P.TRANSFERS_RECEIVE, P.SALES_READ,
    P.SALES_CREATE, P.SALES_REFUND, P.ANALYTICS_READ, P.NOTIFICATIONS_READ, P.USERS_READ,
  ],
  [ROLES.CASHIER]: [
    P.STORES_READ, P.PRODUCTS_READ, P.INVENTORY_READ, P.SALES_READ, P.SALES_CREATE,
    P.NOTIFICATIONS_READ,
  ],
  [ROLES.STORE_HELPER]: [
    P.STORES_READ, P.PRODUCTS_READ, P.INVENTORY_READ, P.SALES_READ, P.NOTIFICATIONS_READ,
  ],
};

function permissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || [];
}

function roleHasPermission(role, permission) {
  return permissionsForRole(role).includes(permission);
}

module.exports = {
  ROLES,
  ALL_ROLES,
  ROLE_HIERARCHY,
  PERMISSIONS,
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  permissionsForRole,
  roleHasPermission,
};
