# Plan 4: customer-owned database preparation

This commit provides the preparation foundation, not completed external-cluster live routing.

## Delivered
- AES-256-GCM encrypted credentials with per-company authenticated binding, random IVs and strict 32-byte key validation.
- Atlas SRV-only input validation; dedicated database names, matching URI database, TLS enforcement and restricted connection options.
- Operator preparation command that requires a customer consent reference and an existing active tenant, checks connection and an empty target, stores a candidate with hidden encrypted credentials, and never changes live routing or copies/deletes data.
- Duplicate candidate attempts fail instead of replacing an existing candidate silently.
- Unit tests for ciphertext tampering, wrong company/key and unsafe connection settings.

## Configuration and execution
Use a customer-created Atlas database user limited to its dedicated database. Set these as private server environment variables: CUSTOMER_DATABASE_URI, CUSTOMER_DATABASE_NAME, CUSTOMER_COMPANY_KEY, CUSTOMER_CONSENT_REFERENCE, TENANT_CREDENTIAL_KEY (64 hexadecimal characters), and existing MONGODB_URI. Keep the encryption key in a secret manager with recoverable backup; losing it makes stored credentials unreadable. Do not put these values in frontend settings, Git or chat.

Run `node scripts/prepare-customer-database.js` from `server`. Its success means connection/list permissions and target emptiness were checked; it does not prove transaction/write permissions, backups or production readiness. Candidate credentials remain unused by application routing.

## Required before cutover
1. Replace operational transaction sessions with sessions from the resolved tenant connection; bind authentication to the current registry connection revision rather than trusting a JWT database name.
2. Refactor payment settlement into a recoverable, idempotent cross-cluster workflow. Existing central billing plus customer invoice updates share one transaction; MongoDB transactions cannot span independent clusters.
3. Implement customer-admin onboarding UI, consent/revocation and credential rotation without exposing secrets to the platform-owner API.
4. Quiesce writes, back up the source, copy scoped customer records preserving IDs, verify content hashes/counts/indexes, test restore, and perform an explicit reversible cutover. Never automatically erase the original database.
5. Test separate Atlas clusters, payment retries, outage handling, restart recovery and cross-company denial in staging.

The backend necessarily handles customer data and decrypts connection credentials. Customer ownership alone does not prevent infrastructure administrators from accessing runtime data. Do not claim zero platform access.

No real customer Atlas credentials were available for integration testing. Existing live database behavior remains unchanged.
