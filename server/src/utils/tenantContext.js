import { AsyncLocalStorage } from "node:async_hooks";

export const tenantContext = new AsyncLocalStorage();

export function getTenant() {
  return tenantContext.getStore() || {};
}
