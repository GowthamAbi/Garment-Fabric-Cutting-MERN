# UG SaaS — IRONING Department development batch (17 October 2026)

**Book1.xlsx:** 20 options across **10 Head F235–F244**, **10 Staff F247–F256**.  
**Branch:** `feature/department-role-sidebar-foundation-20261015` — draft PR #1.  
**Scope:** code development batch, **not 20/20 fully tested user acceptance**. Production `main` and live customer data unchanged.

## Implemented
- Reuses tenant/factory scoped existing `DepartmentLot`, `DepartmentBundle`, `DepartmentEvent`. Real `GOOD` = QC-approved, `IRONING` = received/in progress, `IRONED` = completed/ready for Packing.
- A new `GET /api/erp/departments/ironing-overview` returns lot/DC/section queue, live bundle PCS by stage, completed/received movement history and operator/shift/date targets. Hard limits fail closed rather than produce misleading truncated totals.
- Ironing receipt/completion Staff form calls existing **transactional** `POST /erp/departments/advance` for partial `GOOD → IRONING → IRONED`, protecting stock integrity and idempotent retries.
- Admin-created date/SKU/operator/shift production targets at `POST /erp/departments/ironing-targets`, unique per tenant/factory/combination. Actual PCS comes from committed `ADVANCE` events to `IRONED`, based on **UTC date**. Head sees target vs actual; only company management may save new targets.
- Damage/Re-ironing review requests on `IRONING` or `IRONED` bundles, reason/type/PCS validation, idempotent `POST /erp/departments/ironing-issue-requests`. **No physical quarantine, rework or stock posting** is done by this request; approvals are pending.
- Head queue, pending/completed, ageing threshold (not contractual delay SLA), production report, issue monitoring, ready-for-packing status; Staff received, queue, partial entry, completion, issue request, handover status, bundle code lookup, history, Excel-compatible export, print.
- All 20 workbook entries navigate to shared role dashboard/approvals/tasks or Ironing-specific screens. Automated policy/role/navigation/export tests added.

## Workbook mapping
| Excel | User | Requirement | Route state |
|---|---|---|---|
| F235 / F247 | Head / Staff | Dashboard | Shared role dashboard |
| F236 | Head | Ironing Work Queue | Live bundle list |
| F237 | Head | Target vs Actual | Stored admin target / ERP completion events |
| F238 | Head | Pending & Completed | Current stock status |
| F239 | Head | Re-Ironing / Damage | Non-posting review register |
| F240 | Head | Transfer to Packing Status | `IRONED` ready-to-pack stock (not acknowledgment) |
| F241 | Head | Production Delays | Current bundle age + adjustable threshold |
| F242 / F243 | Head | Pending Approvals / Staff & Tasks | Shared inbox & tasks; issue requests not linked yet |
| F244 | Head | Ironing Reports | Transaction history and export |
| F248 | Staff | Received for Ironing | QC `GOOD` pending intake |
| F249 | Staff | Ironing Plan / Queue | Live queue |
| F250 | Staff | Ironing Entry | Existing transactional ADVANCE |
| F251 | Staff | Completed Qty | Live completion events |
| F252 | Staff | Damage / Re-Ironing Request | Non-posting request only |
| F253 | Staff | Handover to Packing | Read-only `IRONED` status; Packing posts separately |
| F254 | Staff | QR / Bundle Status | Keyboard/USB lookup; camera scan pending |
| F255 | Staff | Ironing History | ERP posted events |
| F256 | Staff | Print & Reports | Browser print + CSV/Excel-compatible export |

## Outstanding acceptance / development
- Ironing→Packing actual receiver acceptance and SKU/bundle handoff reconciliation, route subscriptions, material consumption in Packing; never treat an `IRONED` bundle as a finished carton.
- Enforced damage/quality quarantine, independent manager approval/release and actual audited re-ironing cycle. Current requests must not be represented as executed work.
- True machine/operator scheduling, shift calendars, production reasons/downtime and approved SLA target threshold; age metric is indicative only.
- Camera QR and calibrated label/receipt layout, real authenticated browser/mobile E2E and multi-factory permission/stock reconciliation.
- Historical pagination beyond the current bounded reporting limits, DST/local production date policy; currently UTC.
- Netlify deploy-preview repair and integrated garment line E2E after other department batches.

**CI status:** must verify the latest GitHub Actions before claiming green. Avoid marking these 20 as production-ready.
