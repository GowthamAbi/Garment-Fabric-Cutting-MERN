# UG SaaS — Stitching development batch, 17 October 2026

**Branch:** `feature/department-role-sidebar-foundation-20261015` · PR #1. Do not merge to production before final acceptance.
**Scope:** Book1.xlsx Stitching **21 requirements**: 10 Department Head (F148–F157) and 11 Staff (F160–F170).
**Status:** development batch, NOT 21/21 final integration/production verified. Final multi-department E2E testing deferred by the user.

## Code implementation this batch
- New `GET /api/erp/departments/stitching-overview` checks active **STITCHING** department subscription, Head/Staff read grant and tenant company/factory-scoped `workspaceFilter`.
- Reuses the existing `DepartmentLot`, `DepartmentBundle`, `DepartmentMaster`, `DepartmentEvent` and `DepartmentTarget` data (NO parallel stock balances). Restricts lots to those with Stitching operation lists.
- Live reports: Stitching Lot / DC / Order / Section, sent PCS, ready PCS, operation/WIP PCS, stitched awaiting inward PCS, handed-over PCS and remaining; operation master bulletin and posted advance event counts; saved target rows; issue/rework event summaries; CSV and print actions. Counts reflect *recorded ERP events only*, not mocked estimates.
- New client Stitching Department pages route all 21 Excel options to actual shared dashboard/tasks/approval inbox or dedicated operation/reporting/ERP workspace views.
- Staff action pages reuse existing **approved route + real ERP stock** `Departments` workspace, which supports Stitching master creation, Delivery→Stitching, bundle advance and history/QR trace. The UI does not create a second stock mutation system.
- Head role remains read-only. Saving/stock posting remains governed by existing department and ERP activation middleware.
- Added unit tests for stage totals and event counts, policy role/licensing, workbook role/navigation parity.

## Exact workbook mapping (not E2E acceptance)
| ID | Role | Requirement | Development state |
|---|---|---|---|
| F148 | Head | Dashboard | Shared department dashboard |
| F149 | Head | Stitching Orders & Plans | Live lot / DC / order report |
| F150 | Head | Stitching Operation Progress | Posted operation events and WIP |
| F151 | Head | Line / Vendor Monitoring | Lot section and sent/stitched/pending PCS, no SLA yet |
| F152 | Head | Target vs Actual | Targets and actual event counts are separately shown (period alignment pending) |
| F153 | Head | Bundle & WIP Status | Live bundle stages |
| F154 | Head | Stitching Defects / Rework | Event view; Stitching-specific defect workflow pending |
| F155 | Head | Pending Approvals | Existing generic Head approval inbox |
| F156 | Head | Staff & Tasks | Existing department tasks |
| F157 | Head | Stitching Reports | Live table, export, print |
| F160 | Staff | Dashboard | Shared department dashboard |
| F161 | Staff | Stitching Master / Operations | Existing transactional operation-master ERP workspace |
| F162 | Staff | Assigned Bundles / DC | Lot/DC report; staff assignment rule pending |
| F163 | Staff | Operation Bulletin – View | Master operation sequence |
| F164 | Staff | Stitching Start / Update | Existing transactional ERP bundle advance workspace |
| F165 | Staff | Operation-Wise Completion | Existing advance + read-only event aggregation |
| F166 | Staff | Completed Stitching Qty | Stitched / handed-over counts |
| F167 | Staff | Rework / Defect Entry | Read-only report; dedicated Stitching defect mutation pending |
| F168 | Staff | Handover to Inward | Existing ERP operation flow; cross-role INWARD receipt integration pending |
| F169 | Staff | Bundle QR / History | Existing ERP bundle trace/workspace |
| F170 | Staff | Print & Reports | Table, export and print |

## Known remaining development and E2E gates
- Shift-wise operator production attribution and accurate **same-day target-versus-actual** calculations (current cumulative event view must not be called daily productivity).
- Stitching-specific defect/rework case creation, approval, after-repair quality gate and reconciliation with Checking / Inward.
- Explicit assigned vendor/line capacity & efficiency, live vendor SLA, labour production costing integration and role-based assignments.
- Confirm Delivery vendor-return receipt versus Stitching lot creation cannot be recorded twice; properly link vendor challan IDs across downstream receipt.
- Real multi-company/multi-factory, bundle QR scan/print layout, mobile responsiveness, transaction races/partial handover, auth and full E2E verification.
- Paginate >1,000 lots / 10,000 bundles / 10,000 events: API currently fails closed on reports beyond caps to avoid misleading partial totals.

**Release decision:** Not production ready; no live customer data altered.

## Elastic preservation note (interruption)
Original `ProductionControlPage`, `MachineStatusPage`, `ProductionJob` start/stop/resume and Gantt timeline were **never deleted**. New Elastic workbook navigation had hidden the original timeline. This development batch restores a **read-only** original MachineStatusPage Gantt with seven-day machine report to Elastic Head Progress/Target/Reports and Staff Cutting Entry screens via an isolated `/production/elastic-machine-summary` endpoint. That endpoint is strictly licensed to ELASTIC, guarded for single-factory legacy data and restricted to Elastic production machines/jobs. The original legacy operational start/stop UI remains in the source, but its old warehouse/stock pipeline is **not yet integrated** with the new ERP MTR ledger and should not be declared accepted until reconciliation is complete.
