# UG SaaS — CHECKING Department development (17 October 2026)

**Existing app:** ugsaas.com garment manufacturing ERP.  
**Working branch:** `feature/department-role-sidebar-foundation-20261015`; draft PR #1. **No main merge, production deploy or customer data modification.**  
**Workbook:** Checking **21 Excel rows** = 10 Head F206–F215; 11 Staff F218–F228.  
**Status:** implementation batch with isolated CI; **not 21/21 acceptance verified**.

## Scope added
1. Existing ERP `DepartmentLot`, `DepartmentBundle`, `DepartmentEvent` are the sole source of actual checking stock and inspection history. New tenant+factory scoped `GET /api/erp/departments/checking-overview` produces DC/lot/section pending, good/rework/oil/waste stock, defect category summaries, inspections and recheck event history. Limits fail closed.
2. Staff QC Good/Rework/Oil/Reject uses existing `POST /erp/departments/check`, with a transaction, strict whole-PCS split and stock ledger; no parallel checking stock postings.
3. Staff Oil removal and recheck use existing `POST /erp/departments/advance`: `OIL` -> `OIL_DONE` -> `CHECKING`. Stitching rework must route through Stitching/Inward. Existing bundle movement idempotency keys preserved.
4. Defect category entry stored as prefixed defect text in existing event details. Classification reports identify STITCHING, FABRIC, MEASUREMENT, OIL_STAIN, OTHER; legacy unclassified defects remain visible.
5. Quality Hold Request is a **non-posting review/audit request only**: `POST /erp/departments/checking-hold-requests` with live bundle, category, reason, tenant factory scope and idempotency. **It does not block inventory, change QC stage, quarantine pieces or imply an approved physical hold**. All forms make this explicit.
6. 21 option role menu mapping, dedicated Head views and Staff screens, bundle-code search, matching CSV exports and print, shared tasks and approval inbox navigation.

## Workbook coverage
| Excel IDs | Responsibility / Screen | Implemented route |
|---|---|---|
| F206, F218 | Head and Staff dashboard | shared role dashboard |
| F207–F212 | Checking plans; Pending Qty; Pass/Reject/Rework; Defect analysis; Rework/Oil follow-up; Hold monitoring | dedicated live QC views |
| F213–F214 | Head pending approvals and QC tasks | shared approval/task workspaces (hold request integration pending) |
| F215 | Head QC reports | dedicated inspection summary/export |
| F219–F228 | Staff bundles, check entry, split, classification, Oil, rechecking, hold request, QR, history and reports | dedicated Staff screen, existing posting APIs |

## Further development pending
- End-to-end real QC hold approval + actual stock blocking/quarantine, independent release, safety review. Current request register must **never** be represented as an enforced hold.
- Stitching rework quantity/defect feedback, completed rework receipt, Checking-to-Ironing physical acceptance, stage-wise exception reconciliation.
- Structured standardized defect code master and root-cause analysis, inspector/operator attribution, sampled AQL rule approval.
- Genuine QR camera integration; print calibration/labels; full browser/mobile staging acceptance.
- Cross-factory isolation, data limits/pagination, volume/concurrency tests, live Netlify preview deployment fixes and full E2E later after other departments.

**Verification:** new server/client Node tests and existing CI configured; check latest Actions results separately before claiming green. Do not equate route mappings to production-ready department.
