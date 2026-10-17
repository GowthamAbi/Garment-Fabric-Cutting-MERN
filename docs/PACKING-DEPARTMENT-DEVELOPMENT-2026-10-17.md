# UG SaaS — PACKING Department development batch (17 October 2026)

**Book1.xlsx:** 21 Packing workbook options — 10 Head F263–F272 and 11 Staff F275–F285.  
**Branch:** `feature/department-role-sidebar-foundation-20261015` / draft PR #1. **No main merge or production customer writes.**  
**Status:** functional development batch, not 21/21 accepted E2E.

## Development implemented
1. Added tenant+factory scoped `GET /api/erp/departments/packing-overview`, using **actual ERP DepartmentLot, DepartmentBundle, DepartmentEvent, DepartmentMaster, ErpBalance and ErpSku data**. Includes IRONED ready, PACKED awaiting Dispatch, actual PACK carton history, package material demand vs Accessories stock, size/colour references, plan variance and non-posting repack requests. Limits return an error rather than truncated totals.
2. Preserved the authoritative **`POST /erp/departments/pack`**: partial IRONED bundle, selected matching Packing master, carton creation and Accessories material consumption occur together in existing ERP transaction with idempotency. No new inventory balance or separate accessory issue stock post was added.
3. Added `POST /erp/departments/packing-plans`: date/SKU/optional DC/target PCS, unique per date+SKU+DC+tenant/factory, stored as non-stock planning only. Reported actual uses PACK event carton.lotId to recover lot/DC (legacy PACK events lack top-level lotId).
4. Added `POST /erp/departments/packing-repack-requests`: validates active PACKED carton, category, quantity <= carton balance, reason and retry key. **Non-posting only**: this request does not quarantine/repack or release stock.
5. 21 workbook options map to Head dashboard/approval/tasks or Packing-specific screens. Staff planning, master using existing ERP controls, partial packing entry, Accessories consumption (from PACK document; **no double-issue**), carton label with actual QR image and identity data, live stock, repack request and history/Excel/print.
6. Multi-column desktop/responsive UI, label-size print CSS starting point. Tenant/role/subscription gates remain server-side.

## Workbook
| Excel | Role | Workbook option | Coverage |
|---|---|---|---|
| F263, F275 | Head/Staff | Dashboard | Shared department dashboard |
| F264 | Head | Packing Plan Overview | Saved target vs actual PACK |
| F265 | Head | Ready for Packing | IRONED active bundles |
| F266 | Head | Packed vs Pending | Live IRONED/PACKED balances |
| F267 | Head | Packing Material Availability | Current requirements vs Accessories stock |
| F268 | Head | Size / Colour / Carton Status | ERP SKU+bundle data |
| F269 | Head | Repacking / Damage | Non-posting request register |
| F270, F271 | Head | Pending Approvals, Staff & Tasks | Shared inbox/tasks; repack approval not integrated |
| F272 | Head | Packing Reports | Carton events/export |
| F276 | Staff | Packing Material Master | Existing versioned master + material validation |
| F277 | Staff | Ready for Packing | Live IRONED bundle queue |
| F278 | Staff | Packing Plan | Save nonposting date/SKU/DC targets |
| F279 | Staff | Packing Entry | Existing transactional POST /pack |
| F280 | Staff | Packing Accessories Issue | Read actual PACK consumption; no separate stock issuing |
| F281 | Staff | Size / Colour Assortment | ERP SKU + bundle view |
| F282 | Staff | Carton QR / Label | QR identity + printable carton label |
| F283 | Staff | Packed Stock & Pending | Live quantities |
| F284 | Staff | Repacking Request | Nonposting review request |
| F285 | Staff | Packing History / Print | Actual ERP PACK events |

## Important pending acceptance/development
- Dispatch acceptance, physical carton handover, scanned reconciliation, transport DC and warehouse receipt; PACKED is **not** proof of dispatch.
- Repacking manager approval, enforced stock quarantine, controlled stock reversal/re-entry. Current request is not a stock block.
- Printing to thermal/label printers, QR scan round trip, multi-carton assortment and size/colour mix under a single carton; currently one SKU per ERP bundle/carton.
- Live real-user browser QA, concurrency/E2E across Ironing→Packing→Dispatch and multi-factory access, material valuation reconciliation.
- Report pagination and backdated India/UTC production-day policy.
- Netlify staging preview failing independently of GitHub CI; investigate separately.

**Testing:** policy/role/Excel/export tests added. Verify newest GitHub Actions result before asserting green. Full integrated E2E deferred as requested until department batches are built.
