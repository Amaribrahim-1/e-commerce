// The only place where role names are written. The User schema (enum and
// default) and the authorization middleware read them from here, so a typo
// becomes an undefined property instead of a silently wrong string.
export const ROLES = Object.freeze({
  ADMIN: 'admin',
  CATALOG_MANAGER: 'catalog_manager',
  ORDER_OPERATOR: 'order_operator',
  CUSTOMER: 'customer',
});
