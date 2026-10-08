# Milestone 4 — recovery tooling and Store stock ledger

Includes previous milestones. Staging candidate only; full ERP and all-module stock integration are not complete.

## Encrypted disaster recovery

`server/scripts/tenant-backup.js` exports AES-256-GCM encrypted backups using a company-held passphrase (16+ characters), scrypt key derivation, random salt/nonce and authenticated ciphertext. Wrong keys, tampering and workspace identity mismatches are rejected. BSON Extended JSON preserves ObjectIds and dates. Collection rows and indexes are included, including sensitive user records encrypted inside the file. Keep passphrases separately from backups. Losing the passphrase prevents recovery.

This is an offline maintenance tool for an authorized company administrator/operator. It does not make hosting administrators unable to read the live database. Pause all tenant writes before export; the script requires confirmation but cannot itself enforce the pause. Limit is 32 MiB of serialized plaintext; larger deployments need managed database snapshots. Database exports do not include attachments/object storage, central tenant registry/billing or provider configuration.

From `server`, set MONGODB_URI, BACKUP_COMPANY_KEY and BACKUP_PASSPHRASE privately in your environment. Never put passphrases in command arguments, commit them, or share them in chat.

```sh
# With tenant writes paused and BACKUP_WRITES_PAUSED=YES:
node scripts/tenant-backup.js export company-backup.ugs
# Offline authentication/identity validation:
node scripts/tenant-backup.js validate company-backup.ugs
# Empty tenant destination only; set BACKUP_RESTORE_CONFIRMED to company key:
node scripts/tenant-backup.js restore company-backup.ugs
```

Restore never overwrites existing collections. Use a disposable recovery cluster with the same tenant identity. Failed restore leaves partial recovery data for inspection, without deleting anything. Reconcile central billing/registry, rebuild app schema indexes and check company/user login, stock totals and invoices before enabling access. Existing browser JSON export is explicitly labelled unencrypted business export, not a recovery backup.

## Stock ledger foundation

Store inward/outward now append a tenant-local StockLedger entry in the same transaction as quantity/document writes. Entries hold document reference, quantity, direction, unit and balance. Unique sourceId prevents duplicate ledger posting for the same stored transaction. Model update/delete operations reject edits. Database administrators/raw-driver writes can still bypass model protections; this is not database-level immutability.

Negative, zero, NaN and infinite quantities are rejected before stock writes. Existing outward stock checks remain. Historical records are not backfilled. Existing balances therefore require a reconciled opening snapshot before ledger-based reporting. HTTP retry idempotency keys, correction/reversal workflow, ledger UI, reconciliation reports and Fabric/Cutting/Elastic/Delivery integration remain pending. Ledger entries currently supplement existing balances; they do not replace their source of truth.

## Validation and launch gate

31 local tests pass including encrypted round-trip, wrong-key/tamper rejection and invalid quantity checks. Frontend build/syntax validation are run for this package. Real Atlas backup/restore, rollback, concurrent stock posting and two-company integration tests have not been executed. Use staging only until those checks pass. No production database, GitHub push or deployment was performed.
