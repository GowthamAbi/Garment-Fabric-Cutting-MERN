# Plan 4 — company-owned MongoDB Atlas onboarding

Code implemented; live two-cluster acceptance is still required before onboarding production customers. No live customer data was moved during development.

## Customer workflow
1. The owner creates a company and its company administrator. The company gets a platform trial database and seven-day trial.
2. Company admin opens **Subscription Plan → Your company database**. Admin can validate a connection during the trial; transfer cannot start until the full seven-day period has elapsed.
3. Admin creates a dedicated database/user in their own MongoDB Atlas account, grants that user `readWrite` for this database, allows the backend's outbound network addresses, and provides its Atlas SRV connection string and matching database name in the password-masked form.
4. Admin confirms ownership, transfer consent, external-write maintenance and backup responsibility. Backend validates target emptiness, read/write access and transaction support, encrypts the URI and saves it. It never returns the URI or its encrypted envelope to the frontend or owner API.
5. After seven days, admin closes other ERP screens and clicks **Transfer trial data & use my database**. The server pauses new ERP requests, copies operational records, preserves IDs, builds indexes, verifies record counts and canonical BSON-aware content hashes, then atomically enables the destination in the central registry.
6. New ERP reads/writes use the customer connection. The original source is retained without automatic deletion. A database outage blocks ERP instead of writing to a fallback database. Login, subscription purchase and billing remain available.

Customer DB setup does not grant or extend a subscription. Expired trials still require a verified payment or approved manual subscription before ERP access resumes. Existing paid subscriptions continue to use the billing checks already implemented.

## Data locations
| Location | Records |
| --- | --- |
| Customer Atlas | Operational masters, fabric/cutting/delivery, production, stock, department records, ERP accounting entries, shop sales, workforce and payroll records |
| Platform per-company identity/billing database | Company/factory configuration, user IDs/password hashes/permissions, support grants, subscription payments/invoices and security audit metadata |
| Platform control database | Tenant registry, encrypted connection candidates, billing orchestration, subscriptions, email/payment job queues |

New HTTP audit records retain field names rather than operational values, and database configuration requests never log connection strings. Historical source records, including older audits, remain retained. Backend infrastructure necessarily decrypts a connection URI to operate the application: customer ownership is not a promise of zero infrastructure-administrator access. Platform-owner application access remains subject to existing customer support-grant controls.

## Server configuration required
Set **TENANT_CREDENTIAL_KEY** in the backend environment to one securely generated 32-byte hexadecimal key. Generate it on your own machine or secure server shell:

```js
node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'
```

Back it up securely outside the application. Never put it in Git, frontend `VITE_` variables, screenshots or chat. Keep it stable; changing or losing it makes saved credentials unreadable. Customer connection strings are entered by the company admin in the form, not sent to the platform owner through chat.

Optional **CUSTOMER_DB_MAX_CONNECTIONS=100** caps cached company connection pools (1–500 supported). Each connection has a five-socket maximum pool; size backend resources accordingly. This version has a capacity cap rather than automatic idle-pool eviction. Central **MONGODB_URI** remains unchanged and must support transactions. Customer Atlas must also support transactions.

Both frontend and backend need the new code deployed. Customer migration worker runs every 15 seconds independently of `AUTOMATION_ENABLED`; Razorpay automation still uses its existing setting. Use HTTPS for the frontend/API.

## API
Company administrator only; workspace comes from the authenticated session, not caller-supplied company IDs:
- `GET /api/saas/customer-database`: sanitized status, trial transfer eligibility, encryption configuration flag.
- `POST /api/saas/customer-database`: `{ databaseName, connectionString, consent: true }` validates and saves encrypted credentials. Platform owner, ordinary admin, departmental users and support sessions cannot use it.
- `POST /api/saas/customer-database/transfer`: `{ confirmTransfer: true }` queues transfer after the seven-day period.

The active registry remains immutable with respect to its original platform database name. Operational routing uses a separate customer binding, resolved from the registry. Old JWT database claims cannot choose the physical database. Identity and billing models use the platform client; operational transaction sessions use the customer client, avoiding cross-client MongoDB transactions.

## Safety and failure recovery
- Dedicated Atlas SRV hosts only, matching database names, restricted options, TLS and majority write/read concerns. Reserved names and internal/non-Atlas URLs are rejected.
- Authenticated AES-256-GCM envelopes are bound to the company key. Target fingerprints and in-database ownership markers prevent target reuse by a different company.
- Distributed request counters prevent migration while admitted ERP handlers may be writing. Successful finished responses decrement their counter once. Premature closed sockets or crashes intentionally do not automatically clear counters.
- One durable migration worker claim prevents competing processes from copying concurrently. No timeout-based claim stealing.
- Existing matching destination records may be retained on an inspected resume; mismatches, foreign-company rows, unknown collections and content/index verification failures block cutover. No replacement, deletion or automatic rollback of customer records.
- Transfer failure leaves ERP in maintenance; original platform data is retained. Billing/login remain available. An operator must inspect and resume or cancel. After a successful cutover, do not switch back to the old source: new customer records may exist.

For recovery, stop **all** API and migration worker replicas first and inspect the affected company's status. Then, from `server`, run the appropriate operator command with private central configuration loaded:

```sh
node scripts/recover-customer-database.js --company-key=your-company --action=resume --confirm-all-workers-stopped
node scripts/recover-customer-database.js --company-key=your-company --action=cancel --confirm-all-workers-stopped
node scripts/recover-customer-database.js --company-key=your-company --action=clear-requests --confirm-all-workers-stopped
node scripts/recover-customer-database.js --company-key=your-company --action=reset-validation --confirm-all-workers-stopped
```

`resume` retains maintenance and clears the worker claim so restart can compare/copy remaining records. `cancel` is allowed only before cutover and restores original platform routing, retaining partial target records. For a new attempt after cancellation, use a new empty target. `clear-requests` clears only stale admission counters outside migration. `reset-validation` recovers an interrupted connection validation so the admin can enter credentials again. None of these commands deletes customer records. Do not confirm stopped workers while any old process may still write.

Credential rotation and moving an already active customer database are deliberately rejected by this UI; they require an inspected maintenance migration rather than overwriting a live binding. Existing platform-only legacy backup/migration scripts refuse to touch active customer bindings. Company backup API exports current operational data; use customer-managed Atlas snapshots for independent recovery. JSON backup export is not a concurrent point-in-time snapshot—pause writes or use Atlas snapshots for a consistent backup.

## Verification
- Automated suite: 100 passed, 4 skipped (including the new real two-cluster acceptance test).
- New tests exercise seven-day eligibility, randomized/company-bound encryption, tampering and key mismatch, URI safety, target ownership, company isolation, no platform fallback, distributed request admission/release, admin-only status, resumable copying, corrupt/foreign data rejection and source retention.
- Migration tests use in-memory driver doubles. These do not prove live Atlas permissions, network access, indexes or cross-cluster behavior.
- Frontend production build and server import passed. Frontend behavior has not been exercised with a signed-in production account.
- To run the real acceptance test, configure private **TEST_MONGODB_URI** and **TEST_CUSTOMER_MONGODB_URI** for two disposable transaction-capable staging clusters, then run `node --test tests/customerDatabaseAtlas.test.js` from `server`. It creates random test-prefixed databases, checks actual transfer and an operational transaction, verifies identity remains on the platform client, and cleans up only its generated test databases. Do not use production principals; staging principals need permission to create the generated test databases.

Before the first production transfer, validate Atlas network access, run the two-cluster test, verify an independent backup/restore in staging and check login, paid renewal, expired access, company denial and outage behavior. Provider keys or customer credentials were not available during development, so those live checks remain outstanding.
