# UG SaaS — P0 Step 3 (Batch A): Stock movement safety
Date: 2026-10-17 · feature/department-role-sidebar-foundation-20261015
## Implemented
- Legacy production Warehouse REWORK -> PRODUCTION_READY/REJECTION and PRODUCTION_READY -> SECTION_DELIVERY now use the same MongoDB replica-set transaction for source balance debit, destination stock creation, and unique replay-key record.
- Conditional atomic source decrement prevents overspending concurrent stock; valid 1–1,000,000 integer PCS only. Invalid conversion and rejection reasons are rejected before any writes. Keys 16–100 chars reject reused keys with different requests and forbid other operators from replaying.
- Legacy WarehouseStock was created without a factory field. Modern strict factory/dept users are denied legacy read/write rather than exposed to cross-factory stock; use the factory-scoped `/erp/departments/warehouse-*` ledger instead.
- Client production Warehouse page generates stable request keys until edits/success and sends Idempotency-Key for retries.
- Tests cover validation and actual replica-set partial transfers, idempotent replay, mutation on same key, overdraw and concurrent requests. Canonical Department stock ledger still uses transactional moves and factory-scoped idempotent events.
## Acceptance gaps
- Modern Inventory/Stock warehouse-to-shop multi-factory browser acceptance, real barcode/QR on phones, alerts and replenishment thresholds, ERP vs warehouse physical count reconciliation with operator signoff, full receipt/delivery E2E.
- Legacy data lacks factoryId; do not assume company-level WarehouseStore records can be split into factories without a signed-off migration.
- No production deployment or customer stock changes. Database tests use disposable tenant database.
- Approval QA, security and company admin P0 issues remain as previously reported; this batch is code+CI not 58/58 UAT.
## Release gate
Both GitHub workflows on latest commit must pass. Netlify preview failure is separate and still unresolved.
