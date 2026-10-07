import test from "node:test";
import assert from "node:assert/strict";
import { encryptBackup, decryptBackup } from "../src/utils/backupCrypto.js";
import { positiveStockQuantity } from "../src/utils/stockQuantity.js";
const pass = "company-private-backup-passphrase";
test("encrypted backup round trips without plaintext exposure", () => {
  const text = '{"secret":"private-customer-record"}';
  const encrypted = encryptBackup(text, pass);
  assert.ok(!encrypted.includes("private-customer-record"));
  assert.equal(decryptBackup(encrypted, pass), text);
  assert.notEqual(encrypted, encryptBackup(text, pass));
});
test("wrong key and ciphertext tampering are rejected", () => {
  const encrypted = encryptBackup("records", pass);
  assert.throws(() => decryptBackup(encrypted, "different-private-passphrase"));
  const value = JSON.parse(encrypted);
  const bytes = Buffer.from(value.data, "base64"); bytes[0] ^= 1; value.data = bytes.toString("base64");
  assert.throws(() => decryptBackup(JSON.stringify(value), pass));
  assert.throws(() => encryptBackup("records", "weak"));
});
test("negative outward cannot increase stock through quantity inversion", () => {
  for (const value of [-1, 0, "", "NaN", Infinity, 0.0001]) assert.throws(() => positiveStockQuantity(value));
  assert.equal(positiveStockQuantity("2.5"), 2.5);
});
