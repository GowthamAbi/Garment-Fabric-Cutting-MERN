# UG SaaS – Cutting Department development handoff (17 October 2026)

**Environment:** draft PR #1, `feature/department-role-sidebar-foundation-20261015` only. Production `main` unchanged.
**Workbook:** `Book1.xlsx` Cutting Department, **23 options** (10 Head F33–F42, 13 Staff F45–F57). Catalogue labels remain `UNVERIFIED`: menu navigation is **not** workflow acceptance.

## Implemented in this development batch

- **CUTTING-only authorization:** `/api/production/cutting-machine-plans`, `/cutting-machine-status`, new `/cutting-machines`, and new `/cutting-overview` have specific Cutting read/write middleware *ahead* of the existing Elastic production router. Strict access policy gates on department, role and subscription; Head cannot write machine movements.
- **Legacy single-factory fail-closed guard** on all these routes until factory IDs are migrated to historical Machine and Cutting plans.
- **Machine Master:** dedicated Cutting Spreader/Cutter list, create, edit API and page; validates codes, names, types and capacity. No change/delete to other machine types.
- **Target vs Actual:** read-only plan-wise plan/actual/pending pieces, completion %, planned/actual/waste KG, Spreader/Cutter statuses, CSV and print; limited to latest 250 plans or exact Plan No filter. Reads actual Cutting records instead of presenting decorative figures.
- **Cutting Gantt:** Head Downtime/Gantt and Staff Gantt/Time Status now open combined Spreader + Cutter timelines, reusing existing downtime/one-week report UI.
- **Machine Start/Pause/Complete:** workbook option now goes to the *action-capable* Machine Plan screen rather than a read-only history screen. Explicit `PAUSE` support with required downtime reason and event/Gantt history; legacy `BREAK` remains valid for old records.
- **Spreader/Cutter Head status:** mapped to read-only Plan Number Status instead of the mutation-capable Cutter screen.
- Automated policy/unit/menu parity tests added. GitHub Actions must be green before integration release.

## Exact Excel scope and current functional development status

| Excel | Role | Requirement | Code coverage, not acceptance |
|---|---|---|---|
| F33 | Head | Dashboard | Shared department dashboard |
| F34 | Head | Cutting Plan Overview | Existing Cutting plan history |
| F35 | Head | Spreader & Cutter Status | Both stages read-only status |
| F36 | Head | Target vs Actual | **New actual-data dashboard** |
| F37 | Head | Cutting Pending & Stock | Existing Cutting stock screens |
| F38 | Head | Waste & Recut Monitoring | Waste screen; **recut workflow incomplete** |
| F39 | Head | Machine Downtime / Gantt | **Combined Gantt** |
| F40 | Head | Pending Approvals | Approval inbox, requires assigned grant |
| F41 | Head | Staff & Tasks | Department task screen |
| F42 | Head | Cutting Reports | Existing machine reports |
| F45 | Staff | Dashboard | Shared department dashboard |
| F46 | Staff | Machine Master | **New Cutting-specific master** |
| F47 | Staff | Cutting Planning | Existing machine assignment |
| F48 | Staff | Spreader Assignment | Existing machine assignment |
| F49 | Staff | Cutter Assignment | Existing machine assignment |
| F50 | Staff | Cutting Actual Entry | Existing actual entry workflow |
| F51 | Staff | Machine Start / Pause / Complete | **Action-capable screen & pause support** |
| F52 | Staff | Breakdown / Reason Entry | Action-capable machine screen |
| F53 | Staff | Cutting Stock & Pending | Existing Cutting pending/stock |
| F54 | Staff | Gantt / Time Status | **Combined Gantt** |
| F55 | Staff | Waste / Recut Entry | Waste screen; **recut creation incomplete** |
| F56 | Staff | QR & Bundle Print | Generic machine QR page; **true tracked bundle QR not proven** |
| F57 | Staff | History & Machine Reports | Existing report/print/export |

## Deferred final end-to-end acceptance (as requested)

1. Authenticated dummy-company/multi-role login and isolation, real machine assignment transitions, concurrent queue handling and stop/restart events.
2. Cutting Actual against Fabric Issue ledger, real stock/waste/recut balances, strict cutting availability and handover to Delivery/Folding.
3. One-week Gantt timezone and downtime reasons, print/QR readability and on-paper report layout.
4. Recut-specific request, approval and correction ledger; persisted piece-level bundle identity for QR print.
5. Legacy untagged records migration and multiple-factory segregation.
6. Full 23/23 Head/Staff mobile, permissions, API and staging DB end-to-end checks; only then mark `VERIFIED_COMPLETE`.

**Do not call Cutting Department 23/23 production complete yet.** This handoff documents a meaningful development batch; system-wide final acceptance is intentionally deferred.
