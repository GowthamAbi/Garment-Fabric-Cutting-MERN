# UG SaaS — INWARD Department development batch (17 October 2026)

**Source:** Original `Book1.xlsx` — **21 options**, 10 Head F177–F186 and 11 Staff F189–F199.  
**Branch:** `feature/department-role-sidebar-foundation-20261015`, draft PR #1. No main/production changes.  
**Acceptance:** development batch; **NOT 21/21 final E2E verified**.

## Implemented
- Retained the existing PO/stock `InwardPage` and `/transactions/inward` unchanged; garment stitched Inward is a separate department.
- New tenant/company/factory scoped `GET /api/erp/departments/inward-overview` reuses `DepartmentLot`, `DepartmentBundle`, `DepartmentEvent` and **existing posted ERP stock**, showing DC, order, lot, section/vendor, expected/sent, received, pending PCS, stitched-ready bundles and completed rework.
- Partial inward and completed rework return entry use the **existing `POST /api/erp/departments/advance`**, which validates role/department and subscription, ERP activation, approved route, atomically moves bundle quantities in MongoDB transaction and uses a stable idempotency key. It does not invent a second stock ledger.
- New `POST /api/erp/departments/inward-discrepancies` saves PENDING shortage/excess requests against a real active STITCHED or REWORK_DONE bundle. Its physical count is compared to bundle PCS; the request **never posts stock** and is not auto-approved.
- Head read-only progress and reports, Staff entry, partial receipt, keyboard/scanner-style bundle code lookup, rework return, pending queue, receipt history, CSV and print.
- All 21 workbook options route to shared dashboard/Head approvals/tasks or dedicated Inward screens. Role/menu and pure quantity/permission tests added.
- Bounded monitoring fails closed if report limits are exceeded, rather than returning potentially misleading truncated totals.

## Workbook mapping / scope
| Excel | Role | Option | Coverage |
|---|---|---|---|
| F177 | Head | Dashboard | Existing dashboard |
| F178 | Head | Expected Inward | DC/lot expected, received and pending |
| F179 | Head | Vendor / Section Pending | Section grouped by saved lot |
| F180 | Head | DC-Wise Receipt Progress | Posted ERP receipt totals |
| F181 | Head | Received vs Delivered | Lot sent/received monitoring |
| F182 | Head | Shortage / Excess Monitoring | PENDING physical-count request register |
| F183 | Head | Rework Return Status | REWORK_DONE ready bundles |
| F184 | Head | Pending Approvals | Shared approval inbox, *not yet tied to count requests* |
| F185 | Head | Staff & Tasks | Shared tasks |
| F186 | Head | Inward Reports | Read-only table + export + print |
| F189 | Staff | Dashboard | Existing dashboard |
| F190 | Staff | Expected DC List | Live lot/DC list |
| F191 | Staff | Vendor / Section Inward | Vendor monitoring |
| F192 | Staff | Stitched Goods Inward Entry | Existing transactional ERP advance |
| F193 | Staff | Partial Inward | Existing transactional partial receipt |
| F194 | Staff | QR / Bundle Scan | Bundle code/keyboard scanner lookup; camera scanning pending |
| F195 | Staff | Shortage / Excess Request | Validated non-posting PENDING request |
| F196 | Staff | Rework Return Receipt | Existing ERP stage ADVANCE |
| F197 | Staff | Pending Inward | DC/lot and pending quantities |
| F198 | Staff | Inward History | Posted ERP events |
| F199 | Staff | Receipt Print & Reports | Browser printing and Excel export |

## Development pending
1. Integrate vendor `DeliveryVendorReceipt` (good/rework/rejected) with ERP `DepartmentLot` receipt to prevent duplicate vendor acknowledgment; some legacy Delivery DC vs ERP lot identifiers need migration.
2. Wire physical-count request approval/rejection, controlled posting or reversal and audit trail. Never directly edit inventory or bypass an approval.
3. Validate damaged/rejected inward segregation, explicit inward acceptance to Checking and QC disposition; rework transit may represent second-pass inspection rather than newly delivered PCS.
4. Dedicated camera QR scan, physical printed label/receipt layout and multi-device scans.
5. Cursor pagination, full historical reporting >1000 lots/10,000 bundles/events and 2000 requests.
6. Multi-factory legacy data reconciliation, genuine authenticated Head/Staff staging workflow, concurrent partial receipts, Excel/print/mobile, subscription and app-wide E2E testing.

**CI verification:** check latest Actions for this commit before stating pass. Final integrated system E2E is deferred by owner direction. No customer/production data modified.
