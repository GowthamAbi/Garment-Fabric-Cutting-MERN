import mongoose from "mongoose";
import { getTenant } from "../utils/tenantContext.js";

const DATABASE_PREFIX = process.env.TENANT_DB_PREFIX || "ugs_tenant_";
const CONTROL_DATABASE = process.env.CONTROL_DB_NAME || "ugs_control";

export function sanitizeTenantKey(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(key)) {
    throw new Error("Company key must contain 3-40 lowercase letters, numbers or hyphens");
  }
  return key;
}

export function tenantDatabaseName(companyKey) {
  return `${DATABASE_PREFIX}${sanitizeTenantKey(companyKey).replace(/-/g, "_")}`;
}

export function controlDatabase() {
  return mongoose.connection.useDb(CONTROL_DATABASE, { useCache: true });
}

export function databaseForName(databaseName) {
  const safeName = String(databaseName || CONTROL_DATABASE);
  const allowed =
    safeName === CONTROL_DATABASE ||
    new RegExp(`^${DATABASE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[a-z0-9_]+$`).test(safeName);
  if (!allowed) throw new Error("Invalid tenant database");
  return mongoose.connection.useDb(safeName, { useCache: true });
}

export function currentDatabase() {
  return databaseForName(getTenant().databaseName || CONTROL_DATABASE);
}

export function createTenantModel(modelName, schema) {
  const resolveModel = () => {
    const connection = currentDatabase();
    return connection.models[modelName] || connection.model(modelName, schema);
  };

  return new Proxy(function TenantModelProxy(...args) {
    const Model = resolveModel();
    return new Model(...args);
  }, {
    get(_target, property) {
      const Model = resolveModel();
      const value = Model[property];
      return typeof value === "function" ? value.bind(Model) : value;
    },
    construct(_target, args) {
      const Model = resolveModel();
      return new Model(...args);
    },
    apply(_target, _thisArg, args) {
      const Model = resolveModel();
      return Model(...args);
    },
  });
}

