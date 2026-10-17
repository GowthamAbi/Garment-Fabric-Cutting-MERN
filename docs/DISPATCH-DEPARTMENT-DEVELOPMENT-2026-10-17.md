# UG SaaS — DESPATCH (DISPATCH) Department development — 17 October 2026

**Book1.xlsx:** **21 Despatch requirements**, Head F292–F301 (10), Staff F304–F314 (11). Workbook spells it "Despatch"; role/access/backend code use `DISPATCH`.  
**Development branch:** `feature/department-role-sidebar-foundation-20261015` (draft PR #1). No main merge, no production data touched.  
**State:** functional development batch; full browser/mobile end-to-end acceptance pending.

## Implemented
- Existing ERP `DepartmentLot` / `DepartmentBundle` / `DepartmentEvent` / `ErpDocument` continue as the sole source of posted warehouse stock. The legacy `POST /erp/departments/transfer` posts `PACKED → TRANSIT_WAREHOUSE` atomically, supports partial carton transfers and requires a valid active Warehouse destination and authorization. Existing separate Warehouse receipt posts `TRANSIT_WAREHOUSE → WAREHOUSE:<location>`. Dispatch Staff cannot falsely mark a receipt.
- Optional vehicle number, transporter, driver, LR/docket and loading notes validated and saved in the **same TRANSFER event** (`details.dispatch`). Existing no-transport callers remain backward-compatible; new Dispatch UI requires vehicle/transporter.
- `GET /api/erp/departments/dispatch-overview` provides current PACKED/TRANSIT stock, order/DC/SKU progress, actual dispatch transfer events, linked warehouse receipt events, status IN_TRANSIT / PARTIAL_RECEIPT / RECEIVED, truck details, schedules, exception register and allowed Warehouse masters. Tenant/factory scoped; hard result limits fail closed.
- `POST /dispatch-schedules` saves date/SKU/DC/warehouse target; planning does not post stock. `POST /dispatch-exception-requests` saves a non-posting quality/logistics review with idempotency and reason validation; no physical stock hold/adjustment.
- Dedicated desktop/mobile responsive Head and Staff screens for 21 mapped Excel workbook options. Filters, status, report/Excel export, dispatch entry, transport form, carton QR and printable stock transfer memo.

## Workbook option mapping
| Workbook | Role | Coverage |
|---|---|---|
| F292 / F304 | Head / Staff | Shared dashboard |
| F293 / F305 | Head / Staff | Ready active packed cartons |
| F294 / F306 | Head / Staff | Date/DC/SKU/Warehouse schedule and variance |
| F295 | Head | Order-wise live packed/in-transit totals |
| F296 | Head | Dispatched vs Pending |
| F297 | Head | Warehouse transit/receipt distinction |
| F298 | Head | Aging/exception monitoring |
| F299 / F300 | Head | Shared approval inbox/tasks; Dispatch-specific exception approval is pending |
| F301 / F314 | Head / Staff | Dispatch reports / export |
| F307 | Staff | Stock-safe `/transfer` dispatch entry |
| F308 | Staff | Active assigned Warehouse selection; customer direct dispatch pending |
| F309 | Staff | Vehicle/transport/docket capture |
| F310 | Staff | Loading and handover entry |
| F311 | Staff | Actual posted ERP warehouse transfer memo print (**not statutory challan**) |
| F312 | Staff | Transit pending / partially received status |
| F313 | Staff | Dispatch event history |

## Pending for real production readiness
1. Genuine statutory Delivery Challan/customer dispatch workflow, customer addresses, GST/e-way bill compliance, independent acceptance, signatures and physical POD. This batch prints ERP **stock transfer memo**, not legally compliant tax or delivery paperwork.
2. Explicit transport manifest/vehicle loading batches with multiple cartons, seal number, carton-level receiving scan and shortage exception approvals, fully integrated stock blocks.
3. Dispatch Stock/Warehouse handoff end-to-end in an authenticated browser across department permissions and factory boundaries; test hard result limits, partial receipts, concurrency and all configured subscription combinations.
4. Physical label printer/QR acceptance and mobile visual QA, PDF document outputs, local production-date policy, Netlify deploy-preview repairs.
5. Issue request approval workflow and hold/release; current register cannot stop transfer or adjust inventory.

**CI:** observe and cite latest GitHub workflow status separately. Passing route tests means route coverage, not complete end-user acceptance.
