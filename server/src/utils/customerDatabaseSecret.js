import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function encryptionKey(value) {
  if (!/^[a-f0-9]{64}$/i.test(String(value || ""))) {
    throw new Error("TENANT_CREDENTIAL_KEY must be a 32-byte hex key");
  }
  return Buffer.from(value, "hex");
}

// Bind the ciphertext to its company so copying a record cannot reassign it.
export function sealDatabaseUri(uri, companyKey, key = process.env.TENANT_CREDENTIAL_KEY) {
  if (!companyKey) throw new Error("Company key is required");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(key), iv);
  cipher.setAAD(Buffer.from(companyKey));
  const data = Buffer.concat([cipher.update(uri, "utf8"), cipher.final()]);
  return { version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

export function openDatabaseUri(secret, companyKey, key = process.env.TENANT_CREDENTIAL_KEY) {
  if (!companyKey || secret?.version !== 1) throw new Error("Invalid database credential envelope");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(key), Buffer.from(secret.iv, "base64"));
  decipher.setAAD(Buffer.from(companyKey));
  decipher.setAuthTag(Buffer.from(secret.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(secret.data, "base64")), decipher.final()]).toString("utf8");
}

export function validateCustomerDatabase(uri, databaseName) {
  if (!/^[a-z][a-z0-9_]{2,62}$/.test(String(databaseName || "")) || ["admin", "local", "config", "ugs_control"].includes(databaseName)) {
    throw new Error("Use a dedicated customer database name of 3-63 lowercase letters, numbers or underscores");
  }
  let parsed;
  try { parsed = new URL(uri); } catch { throw new Error("Invalid MongoDB Atlas connection URI"); }
  // Accept Atlas SRV only. Never allow a browser-supplied URI to probe internal services.
  if (parsed.protocol !== "mongodb+srv:" || !/^[a-z0-9.-]+\.mongodb\.net$/i.test(parsed.hostname) || parsed.port || !parsed.username || !parsed.password) {
    throw new Error("A credentialed MongoDB Atlas SRV URI is required");
  }
  const suppliedDatabase = parsed.pathname.slice(1);
  if (suppliedDatabase && suppliedDatabase !== databaseName) throw new Error("URI database name must match the customer database");
  for (const [name, value] of parsed.searchParams) {
    if (!["retryWrites", "w", "appName", "tls"].includes(name) || (name === "tls" && value !== "true")) {
      throw new Error("Unsupported MongoDB connection option");
    }
  }
  return { databaseName, host: parsed.hostname };
}
