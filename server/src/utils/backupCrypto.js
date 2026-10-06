import crypto from "node:crypto";
const MAX_BYTES = 32 * 1024 * 1024;
function key(passphrase, salt) {
  if (typeof passphrase !== "string" || passphrase.length < 16) throw new Error("Backup passphrase must contain at least 16 characters");
  return crypto.scryptSync(passphrase, salt, 32);
}
export function encryptBackup(plaintext, passphrase) {
  const bytes = Buffer.from(plaintext);
  if (bytes.length > MAX_BYTES) throw new Error("Backup exceeds 32 MiB limit; use managed database snapshots");
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(passphrase, salt), iv);
  cipher.setAAD(Buffer.from("UGS-BACKUP-1"));
  const data = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return JSON.stringify({ format: "UGS-BACKUP-1", salt: salt.toString("base64"), iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") });
}
export function decryptBackup(envelope, passphrase) {
  if (Buffer.byteLength(envelope) > MAX_BYTES * 1.4 + 1024) throw new Error("Backup file too large");
  const value = JSON.parse(envelope);
  if (value.format !== "UGS-BACKUP-1") throw new Error("Unsupported backup format");
  const salt = Buffer.from(value.salt, "base64"), iv = Buffer.from(value.iv, "base64"), tag = Buffer.from(value.tag, "base64");
  if (salt.length !== 16 || iv.length !== 12 || tag.length !== 16) throw new Error("Invalid backup envelope");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(passphrase, salt), iv);
  decipher.setAAD(Buffer.from("UGS-BACKUP-1"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(value.data, "base64")), decipher.final()]).toString("utf8");
}
