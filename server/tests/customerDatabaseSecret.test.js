import test from "node:test";
import assert from "node:assert/strict";
import { sealDatabaseUri, openDatabaseUri, validateCustomerDatabase } from "../src/utils/customerDatabaseSecret.js";
const key = "ab".repeat(32);
const uri = "mongodb+srv://customer:secret@cluster.example.mongodb.net/customer_db?retryWrites=true&w=majority";

test("credentials are randomized, authenticated and bound to a company", () => {
  const a = sealDatabaseUri(uri, "company-one", key);
  assert.equal(openDatabaseUri(a, "company-one", key), uri);
  assert.notEqual(a.data, sealDatabaseUri(uri, "company-one", key).data);
  assert.ok(!JSON.stringify(a).includes("secret"));
  assert.throws(() => openDatabaseUri(a, "company-two", key));
  assert.throws(() => openDatabaseUri(a, "company-one", "cd".repeat(32)));
  assert.throws(() => openDatabaseUri({ ...a, data: Buffer.from("tampered").toString("base64") }, "company-one", key));
  assert.throws(() => sealDatabaseUri(uri, "company-one", "weak"));
});
test("only credentialed Atlas SRV with a dedicated matching database is accepted", () => {
  assert.equal(validateCustomerDatabase(uri, "customer_db").databaseName, "customer_db");
  for (const bad of [uri.replace("mongodb+srv:", "mongodb:"), uri.replace("cluster.example.mongodb.net", "localhost"), uri.replace("cluster.example.mongodb.net", "cluster.mongodb.net.attacker.com"), uri + "&tls=false", uri + "&tlsAllowInvalidCertificates=true", uri + "&w=0", uri + "&retryWrites=false", uri.replace("customer_db", "other_db")]) {
    assert.throws(() => validateCustomerDatabase(bad, "customer_db"));
  }
  assert.throws(() => validateCustomerDatabase(uri, "ugs_control"));
  assert.throws(() => validateCustomerDatabase(uri, "admin"));
});
