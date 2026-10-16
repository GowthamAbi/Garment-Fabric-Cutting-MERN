# UG SaaS — 466 Excel Requirement Implementation Tracker
**Review date:** 17 Oct 2026 (IST)  
**Source:** `Book1.xlsx` — Company Admin (466 requested menu options)  
**Branch:** `feature/department-role-sidebar-foundation-20261015` — draft PR #1. **Never equate a sidebar link with a completed functional feature.**

## Current coverage and counts
The original workbook has 58 Company Admin options, 74 Factory Manager options, and 334 department Head/Staff options across 16 departments. These are all captured in `shared/excelRequirementCatalogue.js`. After the first Fabric monitor patch, there are **135 source-code route mappings across department options** (including generic Dashboard, Pending Approvals and Team & Tasks). This is a *navigation metric only*. **All 466 remain unverified against an authenticated DB-backed acceptance checklist** until proven individually; it does not mean all 466 are broken.

| Department | Head | Staff | Total | Linked to UI route | No matching UI route | Current state |
|---|---:|---:|---:|---:|---:|---|
| Fabric | 10 | 11 | 21 | 19 | 2 | Existing Fabric workflows; new scope-guarded Plan & Issue monitoring; write/QA pending |
| Cutting | 10 | 13 | 23 | 22 | 1 | Existing planning/machines/stock screens, complete acceptance not established |
| Accessories | 10 | 10 | 20 | 12 | 8 | Existing inward/PO/stock; before/after sewing issues incomplete |
| Elastic | 10 | 10 | 20 | 14 | 6 | Existing cutting workflow; corrections/shortage work incomplete |
| Delivery | 10 | 10 | 20 | 17 | 3 | Existing vendors/section plan; completion/dependency checks outstanding |
| Stitching | 10 | 11 | 21 | 4 | 17 | Shared ERP route and generic tasks/approvals, specific operation screens pending |
| Inward | 10 | 11 | 21 | 4 | 17 | Shared ERP route; DC-wise stitched receipt screens pending |
| Checking | 10 | 11 | 21 | 4 | 17 | Shared ERP route; defect/rework/quality hold screens pending |
| Ironing | 10 | 10 | 20 | 4 | 16 | Shared ERP route; ironing/re-iron/packing-transfer screens pending |
| Packing | 10 | 11 | 21 | 4 | 17 | Shared ERP route; packing material/assortment/carton screens pending |
| Dispatch | 10 | 11 | 21 | 4 | 17 | Shared ERP route; schedule/DC/vehicle/transit screens pending |
| Warehouse | 10 | 12 | 22 | 7 | 15 | Existing generic warehouse, scoped stock entries/reconciliation incomplete |
| Shop | 10 | 11 | 21 | 8 | 13 | Existing shop/POS UI, Excel-specific finance/returns validation pending |
| Marketing | 10 | 10 | 20 | 4 | 16 | Existing marketing analysis; customer/lead/follow-up workflow pending |
| HR | 10 | 11 | 21 | 4* | 17 | Not in licensed department catalogue; existing HR module is separate |
| Accounts | 10 | 11 | 21 | 4* | 17 | Not in licensed department catalogue; existing Finance module is separate |
| **TOTAL** | **160** | **174** | **334** | **135** | **199** | **0 of 334 individually accepted as fully complete** |

`*` Generic route metadata only. HR and Accounts have no active licensed department workspaces.

## First one-by-one development batch — Fabric
- [x] Reviewed exact 21 workbook labels against actual frontend route mappings.
- [x] Added read-only plan monitoring screen and bounded filtered API; mapped Fabric Head **Production Plan Overview** and **Issue to Cutting Monitoring**.
- [x] Strict role boundary mapping for `GET /api/fabric-cutting/fabric-plan-monitor`, with no mutations on the monitor route.
- [x] Legacy plan records lack `factoryId`; monitoring fails closed for multi-factory companies rather than leaking another factory's data.
- [x] Unit tests pass for filter input, role/mutation restrictions, factory scope; frontend build succeeds.
- [ ] Real authenticated Fabric Head/Staff staging login, database query and mobile/print acceptance.
- [ ] **Fabric Purchase & Availability** — procurement visibility and accurate availability source.
- [ ] **Fabric Issue / Transfer** — authorised transactional stock deduction, atomic consistency, retest, audit and history.
- [ ] **Production Plan** Fabric Staff role — existing page targets Cutting-only API; needs role-appropriate workflow, not a bypass.
- [ ] Source-linked plan/inward history, exact batch/set and roll QR, negative-stock prevention and print regression testing.
- [ ] Multiple-factory plan records migration (factoryId tagging), with controlled handling of unscoped legacy data.

## Release gates for each department
1. Exact **Head + Staff** Excel labels exist with working, semantically matching route. Generic redirect ≠ implemented feature.
2. Entry, validation, persistence, edit/correction, history, PDF/print or QR implemented as appropriate; zero unauthorized writes.
3. Company/factory/department tenant isolation and subscription enforcement tested on real staging MongoDB.
4. Approved workflow transitions and stock/accounting invariant tests pass.
5. Browser desktop/mobile, light/dark, printing and four-role acceptance reviewed.
6. CI green and staging smoke checks pass before marking `VERIFIED_COMPLETE`.

**Production status:** Not approved. All work stays on the draft development branch / isolated staging until owner verification.
