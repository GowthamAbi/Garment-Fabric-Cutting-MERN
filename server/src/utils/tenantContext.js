import { AsyncLocalStorage } from "node:async_hooks";

export const tenantContext = new AsyncLocalStorage();

export function getTenant() {
  return tenantContext.getStore() || {};
}

export function runWithTenant(tenant, callback) {
  return tenantContext.run(Object.freeze({ ...tenant }), callback);
}
