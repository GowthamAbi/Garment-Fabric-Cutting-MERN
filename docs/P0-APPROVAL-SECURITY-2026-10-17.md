# UG SaaS — Phase 2 P0 Batch 02: Approval Queue and Grant Security

**Date:** 17 October 2026 · **Branch:** feature/department-role-sidebar-foundation-20261015 · **Scope:** security hardening in draft PR. No main merge, deployment or live customer mutation.

## Audited P0 workbook cells
- **D5**, **D67–D72**, **D93**: Factory Manager review queue, purchase/production/variance/rework/dispatch exception decisions, approval history and notification counts.
- **A73–A76**: Company Admin production, Warehouse, Shop approval queues and approval history.
- **A106**: Security / owner-managed approval grants.

## Fixes
1. **Company and factory authorization:** Strict-policy reviewer must have current factory in explicit `assignedFactoryIds`, plus active factory and company identity; disabled/other-factory requests denied.
2. **Head / Manager scopes:** Head inbox only permitted department + explicit `approval.head.<department>`. Management `approval.fm` grants apply only to assigned department when scope is DEPARTMENT, or granted departments within assigned factory when LOCATION.
3. **Approval history confidentiality:** Previously `company_admin` or `admin` base roles could see any department approval history in their factory under strict access. History now requires department read permission in the active department, or a company-scoped `company.settings` grant. Legacy roles retain bounded compatibility.
4. **Settings confidentiality:** Strict company admins need COMPANY scope + `company.settings` even to read monetary approval thresholds. Settings change remains verified owner only.
5. **Owner grant directory:** `GET /approval-grants` now verifies owner identity against the actual company and checks active factory, instead of trusting role name.
6. **Atomic owner grant audit:** `PUT /approval-grants/:id` now commits user permission/sessionVersion change and `AuditLog` event in one MongoDB transaction; a failed audit rolls back the permission update. Existing compare-and-swap prevents stale version changes.
7. **Financial/stock posting:** Approval requests and outbox events remain non-posting. Threshold and independent-approver rules are unchanged; self-approval and above-owner-limit approvals remain rejected.

## Testing vs acceptance
- New server policy tests verify strict factory, company, department, missing grants, history/settings, self approval, escalation and over-limit behaviour.
- New `server/tests/p0ApprovalAccessDatabase.test.js` exercises owner grant changes, persisted grant AuditLog, reviewer inbox filtering, wrong-factory rejection, real decision outbox and duplicate-decision conflict on a **disposable GitHub CI MongoDB replica set**. The Database QA workflow explicitly executes this test; check that it reports a non-skipped pass before claiming database coverage. Authentication through real signed user sessions and live browser acceptance are still separate.
- No P0 workbook cell is marked **UAT PASSED** solely from unit/CI evidence. All 58 P0 remain subject to signed-off role-wise browser/mobile testing, screenshots and tenant isolation checks.

## Follow-up P0 priority
1. Authenticated cross-role approval HTTP tests (OWNER → FM → HEAD, rejected wrong-factory) and audit outbox visibility/retention.
2. Procurement approvals vs actual purchase invoices, production plan/change isolation.
3. Company Admin stock shortages/variance, Warehouse/Shop reconciliation and double-posting prevention.
4. Finance and billing controls (payments, subscriptions, ledger and statutory gaps).

**Release gate:** Verify both GitHub Actions runs on this exact commit. Netlify deploy-preview failure remains a separate staging blocker.
