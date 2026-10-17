# UG SaaS — Elastic Department development batch (17 October 2026)

**Repository branch:** `feature/department-role-sidebar-foundation-20261015` · draft PR #1.
**Excel scope:** 20 options: Department Head 10 (F92–F101), Staff 10 (F104–F113).
**Release status:** development stage; not 20/20 production verified. Production `main` remains unchanged.

## Changes delivered
- Added dedicated **ELASTIC** workspace and API at `/api/erp/departments/elastic` using the **existing tenant-scoped ERP inventory ledger** (`ErpSku`, `ErpBalance`, `ErpDocument`); no second Elastic stock balance source.
- Dedicated Elastic raw material master with **MTR** as mandatory unit; stock availability and minimum-stock shortage overview.
- Supplier Purchase Order and linked Elastic Goods Receipt using ERP `postDocument` transaction, stock constraints, and idempotency key. Requires existing ERP supplier master and ERP activation.
- **Elastic Cutting Plan** is created only when a real **COMPLETED FabricCutActual** is present with **approved GarmentItemMaster** size-wise elastic measurement. Creates tenant-scoped Elastic plan containing colour, size, PCS, measurement/MTR and target MTR. Legacy FabricCutActual access fails closed for multi-factory companies pending migration.
- **Elastic Cutting Entry** issues size-wise MTR via transactional ERP `STOCK_TRANSFER` from `ELASTIC` to `DELIVERY` (Delivery subscription required). Colour/size/plan/ref are embedded in the immutable document notes. The ERP prevents stock going negative.
- **Elastic Issue/Return:** Delivery-to-Elastic ERP `STOCK_TRANSFER`; plan and colour-size quantity checks, ERP idempotency/ledger enforcement.
- Head **Target vs Actual** and Staff **Progress/History** derive MTR issued/returned from posted ERP transfers, including per-size ledger trace and remaining target. Excel/CSV and print affordances included.
- Wastage/physical-count **correction request** stored separately in tenant-scoped `ElasticCorrectionRequest` with PENDING status; **no direct change to inventory**.
- All 20 exact Excel options route to existing department dashboard/Head approvals/Head tasks or dedicated Elastic workspace pages.
- Added server pure-policy and frontend 20-option parity unit tests. Existing Fabric replica-set regression job still runs in CI.

## Workbook line-by-line status
| Excel | Role | Requirement | Coverage / known gap |
|---|---|---|---|
| F92 | Head | Dashboard | Shared dashboard |
| F93 | Head | Elastic Plan Overview | Actual Elastic plans with MTR targets |
| F94 | Head | Material Availability | ERP balance and minimum shortage |
| F95 | Head | Target vs Actual | Posted issue/return MTR vs target |
| F96 | Head | Elastic Cutting Progress | Size-wise ERP transfer progress |
| F97 | Head | Pending Issues / Shortage | Stock shortage and outstanding plans |
| F98 | Head | Wastage Monitoring | Pending correction count; authorized write-off not yet implemented |
| F99 | Head | Pending Approvals | Existing general approval inbox; Elastic corrections not yet wired |
| F100 | Head | Staff & Tasks | Existing generic department tasks |
| F101 | Head | Reports | Stock, plan, issue, correction, CSV/print |
| F104 | Staff | Dashboard | Shared department dashboard |
| F105 | Staff | Elastic Material Master | New MTR SKU master |
| F106 | Staff | Elastic Inward | PO and linked goods receipt |
| F107 | Staff | Elastic Cutting Plan | From completed Cutting Actual + approved measurements |
| F108 | Staff | Elastic Cutting Entry | Ledger-backed size-wise MTR handoff |
| F109 | Staff | Elastic Issue / Return | Traced ERP transfers between Elastic and Delivery |
| F110 | Staff | Elastic Stock & Balance | Read-only ERP stock |
| F111 | Staff | Wastage / Correction Request | Non-mutating approval request |
| F112 | Staff | History | Posted transfers, size and plan trace |
| F113 | Staff | Print & Reports | Shared report export/print controls |

## Not complete / deferred final acceptance
1. **Concurrency safety:** current cut/return plan cap is checked before `postDocument`; shared ERP stock is transaction-serialized, but an additional *atomic per-plan/size reservation* is required to prevent concurrent requests from exceeding a specific plan target when sufficient total stock exists.
2. Legacy `ProductionJob` and `WarehouseStock(BALANCE_ELASTIC)` data are not reconciled with new ERP ledger; migration and one canonical inventory pipeline are necessary before activating operational double writes.
3. Elastic correction request decision / Wastage posting and Head approval are not wired to safe ERP reversal/write-off. Request creation alone must never silently change stock.
4. Elastic plan cancellation/replan, overage/rework rules, variation tolerance, return linked to specific issue, supplier returns, purchase and stock aging, physical QR/print/mobile audit remain pending.
5. Full real-tenant Head/Staff login E2E, workflows with genuine Fabric→Cutting→Elastic→Delivery stock transfers and actual printing deferred per owner instruction.
6. Scoped ERP CORE subscription, activated ERP and Delivery licence are required for transactional work; UI should surface onboarding dependencies in final QA.

**Decision:** Elastic core development batch exists; **NOT** 20/20 verified complete or production-ready. This batch can be tested later with other departments. Production unchanged.
