# UG SaaS – Fabric Department | 21 Excel Requirements
**Review:** 17 October 2026 (IST)  
**Source:** Excel Fabric Head F4–F13; Fabric Inventory/Staff F16–F26  
**Branch:** `feature/department-role-sidebar-foundation-20261015` · draft PR #1  
**Release:** Development/staging only; NOT PRODUCTION READY.

## Meaning of status
- **Implemented in code / QA pending:** Dedicated relevant route/API exists; requires authenticated staging entry, database and role acceptance.
- **Partially implemented:** Some function exists, but exact Excel user intent is not fully satisfied.
- **Not individually accepted:** No authentic end-to-end test has passed yet. All 21 requirements remain `UNVERIFIED` in the master catalogue until acceptance, even though all 21 link to real UI routes.

## Exact workbook checklist

| Excel | Role | Requirement | Implementation | Acceptance remaining |
|---|---|---|---|---|
| F4 | Head | Dashboard | Department dashboard API/UI | Authenticated KPIs and mobile |
| F5 | Head | Fabric Purchase & Availability | Supplier/DC inward + balance/requirements live view | Full Purchase Order lifecycle is not integrated |
| F6 | Head | Inward & Roll Monitoring | Live inward list; per-inward roll & QR history | Saved roll/weight accuracy, B/W print |
| F7 | Head | Production Plan Overview | Dedicated read-only Fabric plan monitor + filter | Actual factory-scoped staging plan data |
| F8 | Head | Folding Status | Read-only saved folding date/weight/quality | Real Cutting Actual → Folding dependency |
| F9 | Head | Fabric Stock & Shortage | Existing balance stock view | Negative stock, reservations, date filters |
| F10 | Head | Issue to Cutting Monitoring | Live plan-issued/pending KG and allocation rows | Legacy issue audit vs new transactional ledger |
| F11 | Head | Pending Approvals | Approval Inbox | Approval grant and rejection tests |
| F12 | Head | Staff & Tasks | Dedicated task API and screens | Admin assign / Staff update / Head review |
| F13 | Head | Fabric Reports | Supplier, stock, plans, issues; Print/Excel | PDF/BW print/mobile checks |
| F16 | Staff | Dashboard | Department dashboard | API scope and KPIs |
| F17 | Staff | Fabric Master | Staff can save/update Fabric Master | Process master remains admin-only; duplicate code checks |
| F18 | Staff | Fabric Inward Entry | Inward receipt + roll/QR existing forms | Real data save/edit lock/batch/set/print |
| F19 | Staff | Production Plan | Dedicated Fabric GET/setup/POST/PUT APIs; edit unissued | Live multi-colour/size reservation consistency |
| F20 | Staff | Folding Entry | Existing saved folding flow | Cutting-complete prerequisite, print |
| F21 | Staff | Fabric Stock | Existing available/inward balance | Reconcile actual roll and plan reservations |
| F22 | Staff | Batch & Set Tracking | Roll stock batch/set balance report | Exact serial/DC grouping |
| F23 | Staff | Roll QR Code Print | Existing QR screen | Real printer and QR readability |
| F24 | Staff | Fabric Issue / Transfer | NEW plan/inward/colour/dia/weight entry, transaction, FIFO roll allocation, idempotency ledger | Database transaction E2E and Cutting receipt integration |
| F25 | Staff | Inward & Plan History | Combined inward, plans, issue register with unissued plan edit | Real history/role validation |
| F26 | Staff | Reports & Print | Consolidated print/export report | Real Excel/PDF/BW/mobiles |

**Navigation parity:** All 21 exact Excel items now resolve to a declared page (not 21 completed end-to-end workflows).

## New risk-controlled behavior
- `/api/fabric-cutting/fabric-plans`: assigned Fabric Staff create/edit; Fabric Head read-only; legacy plans limited to single active factory until records acquire factory IDs.
- `/api/fabric-cutting/fabric-issues`: Fabric Staff only POST. Idempotency key, colour **and dia** required. Checks remaining plan requirements, inward colour balance, active FIFO roll balance; writes plan allocation, inward balance, roll deductions and issue register in ONE MongoDB transaction, or aborts all of them. Read-only history for Head.
- Retention lock prevents permanent deletion. New Plan UI offers edit of unissued plans, no delete.
- Existing `/api/fabric-cutting/plans/:no/issue` is a separate **legacy Cutting route** and must be migrated/retested before end-to-end production approval. Two issue writers should not be considered fully reconciled before this is tested.
- Old Fabric plan data lacks factory ID. Multi-factory Fabric Plan routes explicitly fail closed, pending migration to factory-tagged records.

## Final staging acceptance procedure
1. Create/identify a disposable staging company with subscribed `FABRIC` and one active factory, plus Company Admin, Fabric Head and Fabric Staff (no credentials in GitHub/chat).
2. Save Fabric Master and approved garment/item master; receive fabric with DC, colour, dia and rolls; verify original quantity, batch/set and roll QR. Ensure print looks professional.
3. Staff creates plan; Head sees production requirement; Staff edits unissued plan; create Cutting Actual then Folding; Head sees folding status.
4. Issue a partial valid KG from a selected colour/dia; verify plan, inward and correct Dia roll balances all change by exactly the same KG. Retry with same key: no double deduction. Force invalid weight, wrong Dia, oversubscription and transaction failure: no partial updates.
5. Compare roll/batch stock, fabric stock/reservations, Head overview, staff/approval Tasks, Inward/Plan History, Reports/Print and mobile/light/dark.
6. Validate cross-company, cross-factory, cross-department, Head read-only rules and subscription expiry.
7. Mark **VERIFIED_COMPLETE** only after positive and negative tests pass; get owner approval before merging into main.

**Latest CI at time of this report:** backend 219 pass, 7 DB integration skipped; frontend 26 pass; frontend build successful. **No real user login-based E2E claim**. Live `ugsaas.com` remains unchanged.
