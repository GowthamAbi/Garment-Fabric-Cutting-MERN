# UG SaaS — Accessories Department Development (17 October 2026)

**Branch:** `feature/department-role-sidebar-foundation-20261015`, draft PR #1.
**Scope:** 20 exact `Book1.xlsx` Accessories options; 10 Head (F64–F73) and 10 Staff (F76–F85).
**Stage:** development batch implemented and pushed; full final E2E acceptance deferred per owner instruction. No production deployment.

## Implementation completed in this batch
1. Isolated Accessories route under `/api/erp/departments/accessories` sharing the **existing ERP stock ledger**, not a duplicate stock collection. Every endpoint checks licensed department and read/write role, using existing tenant-aware company/factory-scoped models.
2. Dedicated Head/Staff Accessories UI with stock availability, shortage, Work Order/BOM component requirements, purchase status, receipt, issue before sewing, issue after sewing, return, Delivery transfer, pending stock-correction request, issue history, CSV and printing.
3. Staff Accessories SKU master creation limited to RAW and CONSUMABLE SKUs located in ACCESSORIES. Master records have validated unique code/name/unit and minimum level.
4. Supplier-linked Purchase Order and PO-linked Goods Receipt use existing transactional `postDocument` and stock ledger, which enforce ERP activation, idempotency and PO remaining quantity. Supplier master needs to exist.
5. Before/After Sewing material issue and return use transactional ERP `MATERIAL_ISSUE`/`MATERIAL_RETURN`, posted Work Order/BOM, stock limit and idempotency. The separate stage is recorded in the ERP document's notes as `ACCESSORIES|ISSUE/RETURN|BEFORE_SEWING/AFTER_SEWING|REFERENCE`.
6. Transfer to subscribed DELIVERY uses the ERP's transactional `STOCK_TRANSFER` and deducts ACCESSORIES stock.
7. Physical-count shortage/adjustment is a **PENDING REQUEST ONLY** and does not silently change ERP stock.
8. Work Order component requirement quantities are derived from posted BOM-scaled component requirements minus issue plus return documents; available quantities come from ERP balances. Available stock is shared between orders and not yet reserved to a specific order.
9. All 20 exact Excel navigation entries mapped to real pages or shared dashboard/task/approval screens. This is **routing coverage**, not 20/20 business acceptance.
10. Added pure calculation/validation/permission and frontend route-parity tests; preserved Fabric MongoDB regression workflow.

## Exact options mapping and outstanding semantic gaps

| Excel | Head/Staff | Requirement | Scope now |
|---|---|---|---|
| F64 | Head | Dashboard | Shared department dashboard |
| F65 | Head | Accessories Requirement | New posted BOM demand report; multi-plan reservations not yet held |
| F66 | Head | Accessories Purchase Status | New PO/receipt/pending summary |
| F67 | Head | Stock Availability | New ERP-based stock and minimum alert |
| F68 | Head | Before-Sewing Issue Status | New stage-filtered ERP issue history |
| F69 | Head | After-Sewing Issue Status | New stage-filtered ERP issue history |
| F70 | Head | Shortage & Consumption | New requirement, shortages, issue/return and requests |
| F71 | Head | Pending Approvals | Existing approval inbox; accessories adjustment requests not yet wired to final approval/ledger reversal |
| F72 | Head | Staff & Tasks | Existing shared department task screen |
| F73 | Head | Reports | New stock/PO/issue/shortage overview and CSV/print |
| F76 | Staff | Dashboard | Shared department dashboard |
| F77 | Staff | Accessories Master | New validated SKU registration |
| F78 | Staff | Purchase / Inward Entry | New PO and receipt ERP workflows |
| F79 | Staff | Accessories Stock | New live stock read |
| F80 | Staff | Before-Sewing Issue | New Work Order/BOM-bound ERP issue |
| F81 | Staff | After-Sewing Issue | New stage-tagged ERP issue; physical sewing-complete validation pending |
| F82 | Staff | Return / Transfer Entry | New ERP material return and Delivery transfer |
| F83 | Staff | Shortage / Adjustment Request | New request registration; no automatic ledger mutation |
| F84 | Staff | Issue History | New ledger-based movement history |
| F85 | Staff | Reports & Print | New report/export/print; paper/mobile validation pending |

## Remaining development / integration blockers before acceptance
- **Sewing readiness:** `AFTER_SEWING` currently a validated, recorded stage label, not an independently proven Sewing/Checking completion gate. Link to stitching/inward state and reject premature issue.
- **Approvals:** wire Accessories adjustment approval/rejection into the proper approval chain and ledger-safe correction/reversal; never directly edit `ErpBalance`.
- **Business workflow:** buyer/order allocations, partial returns, requisition/consumption linking, purchase cancellation, return/transfer reconciliation with destination acknowledgement.
- **Role/browser QA:** verify real staging tenant Head/Staff login, permission grant and subscription state for all actions.
- **Inventory and reports QA:** live actual data, price privacy, retention, returns/negative-stock, idempotent concurrency, limited 250/500/1000-record pagination and csv/print/mobile layouts.
- **Final E2E:** Fabric → Cutting → Accessories before/after Sewing → Delivery integration. Existing Fabric/Cutting legacy tables and ERP ledger need migration/readiness reconciliation.
- **ERP activation:** posting is intentionally blocked unless the company has reviewed opening balances and activated integrated ERP; the new forms must not bypass this control.

**Do not claim 20/20 VERIFIED_COMPLETE or production-ready.** The user explicitly deferred system-wide E2E verification; code development remains in staged batches.
