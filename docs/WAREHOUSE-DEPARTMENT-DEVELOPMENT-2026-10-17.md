# UG SaaS — WAREHOUSE Department development batch (17 October 2026)

**Original Book1.xlsx:** Warehouse **22 options**: 10 Head F321–F330, 12 Staff F333–F344.  
**Branch:** `feature/department-role-sidebar-foundation-20261015` (draft PR #1). No main merge or production writes.  
**Status:** development implementation and CI test coverage; not 22/22 full end-user UAT.

## Implemented
- Dedicated `GET /api/erp/departments/warehouse-overview` aggregates actual tenant/factory + **assigned Warehouse** ERP bundle/lot/master records into location/bin/SKU/size/colour stocks. Inbound `TRANSIT_WAREHOUSE`, warehouse `WAREHOUSE:<code>` stock, and outbound `TRANSIT_SHOP:<code>` are distinct and never summed as a single balance.
- Inbound Dispatch and Shop-origin warehouse returns use real `DepartmentEvent` transfers, linked by `details.bundle.parentId`, showing IN_TRANSIT/PARTIAL_RECEIPT/RECEIVED separately from pending live transit stock. Shop-bound transit uses its original (possibly zero-PCS) Warehouse source to enforce Warehouse assignment.
- Active Warehouse master, Rack/Bin master and put-away/relocate screens reuse existing `/masters`, `/warehouse-bins` and `/relocate` transaction APIs; old ERP material stock ledger remains authoritative.
- Staff inbound partial physical receipt, Warehouse → Shop transfer and Shop → Warehouse return acceptance rely on existing `/transfer`. Source authorization is checked before cross-department handoff; receiving Shop or Warehouse remains responsible for confirming physical receipt.
- Staff physical stock count, MISSING/DAMAGED adjustment request call existing `/stock-exceptions` (non-posting until separate independent Company Admin approval). Equal counts require no request; excess stock requires reviewed source receipt. Head monitors pending/count discrepancies; shared Admin approval inbox exists, but a specific head approval on Warehouse stock exceptions is not granted.
- Stock ledger + authenticated trace QR reused from the existing `BundleTrace` and `/trace/:id`.
- Excel option routes to Head/Staff views, responsive summary tables, search, CSV/Excel-compatible downloads, browser print.
- All lists enforce capacity limits fail-closed (no fabricated partial totals).

## Mapping
| Excel | Role | Workflows |
|---|---|---|
| F321/F333 | Head/Staff | Shared dashboard |
| F322 | Head | Warehouse Stock Overview |
| F323 | Head | Inbound / Outbound Status |
| F324 | Head | Pending Receipts |
| F325 | Head | Stock Transfers |
| F326 | Head | Stock Aging / Shortage |
| F327 | Head | Stock Variance Monitoring |
| F328/F329 | Head | Shared approvals + tasks; independent Admin stock exception decision unchanged |
| F330 | Head | Warehouse Reports |
| F334 | Staff | Warehouse / Location Master |
| F335 | Staff | Inbound Receipt |
| F336 | Staff | Put-Away / Location Entry |
| F337 | Staff | Warehouse Stock |
| F338 | Staff | Stock Issue / Outward |
| F339 | Staff | Transfer to Shop |
| F340 | Staff | Shop Return Receipt status/receipts in Inbound Receipt screen |
| F341 | Staff | Physical Stock Count |
| F342 | Staff | Stock Adjustment Request |
| F343 | Staff | Stock Ledger / authenticated Bundle QR |
| F344 | Staff | History & Reports |

## Still pending
- Genuine stock count equality attestation/continuous cycle-count registry, approval linkage inside Warehouse Head dashboard, damaged quarantine and accepted surplus receipt workflow.
- Cross-department real browser acceptance for Dispatch → Warehouse → Shop → Warehouse return with actual factory roles and multi-warehouse assignments, atomic concurrency tests.
- Cross-factory/ERP reconciliation against immutable stock journal and physical barcode readers, handheld/mobile print, large data pagination, lot aging policy.
- True delivery challan/e-way bill/customer delivery; Warehouse report exports are not statutory stock documents.
- Netlify preview failure is independent of GitHub CI and blocks staging visual acceptance.

**Testing:** policy/role/workbook/export tests added; latest CI and Netlify preview status must be checked separately.
