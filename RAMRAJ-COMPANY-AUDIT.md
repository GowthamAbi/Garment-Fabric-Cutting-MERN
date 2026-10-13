# Ramraj company admin — findings and fixes

13 October 2026. Target: https://ugsaas.com/c/ramraj/login

## Live inspection status

The company login page rendered after initial navigation/session-check delay. Secure authentication was offered; authentication did not complete. No signed-in Ramraj page was observed. No Ramraj dummy record, user, permission assignment, payment or message was submitted. The user-supplied credentials were not stored in this report.

Full live acceptance remains pending; this report must not be interpreted as a completed company workflow audit.

## Source-confirmed findings

| Finding | Change |
|---|---|
| Bell dropdown lived inside the header stacking context and could appear behind fixed subscription notice/UI | Render the dropdown through a React portal under document.body with fixed placement, viewport bounds and independent overlay order. Outside click includes both trigger and portal; Escape closes and returns focus. |
| Dashboard marks exactly four legacy departments Live and the rest Ready using hard-coded labels | Display Configured or Permission required from the existing authorization policy. Keep unsupported legacy entry totals unavailable, rather than claiming zero integrated records. |
| Dashboard department details only offered reports/timeline/stock/approvals | Add Open department workspace and User assignment actions. |
| Dedicated sidebar groups covered only the original department subset | Add subscribed/permitted workspace links for every supported department. |
| Department Entry falls back to Dashboard for downstream departments | Route every supported department to its matching integrated workspace. Server subscription, role, factory and ERP activation checks are retained. |
| User scope assignment requires typing a department code | Use a labelled dropdown from the company's enabled department list. Assignment still uses the existing reviewed-role endpoint and session invalidation. |
| Company cards/forms have inconsistent visual density | Add company-scoped typography, restrained cards, aligned fields, wrapping actions, scrollable tables and one-column mobile forms. Printed documents are unaffected. |

## Access diagnosis

Configured does not mean a particular user can read/write. A working department needs the company licence/entitlements, active subscription, the appropriate department read/write permission, reviewed role/scope, assigned factory/location and ERP activation for ledger writes. Unsubscribed or unauthorized access is not bypassed by typing a page name.

All 14 catalogue codes now have a workspace entry route: Fabric, Cutting, Elastic, Accessories, Delivery, Stitching, Inward, Checking, Ironing, Packing, Dispatch, Warehouse, Shop and Marketing.

## Pending Ramraj acceptance checklist

- Verify subscription, enabled departments, ERP activation, assigned factories and administrator permissions.
- Open all 14 permitted workspaces; record read/write availability and exact server errors.
- Create uniquely labelled QA masters and dummy entries, then verify save/reload/edit, stock conservation, history, reports and prints.
- Review/create a test department user, assign only the intended department/factory permissions, then sign in as that user and verify both allowed and denied access.
- Verify notification popup stays above subscription notice at phone/tablet/desktop widths, dark theme, scroll and keyboard Escape.
- Test partial production handoffs, duplicate submissions, stock limits, exports and QR/print.

Validation: 166 server tests — 159 passed, 0 failed, 7 database scenarios skipped. Production build and both static layout render checks passed. Sidebar access refreshes when changing pages so trial/payment configuration does not remain stale. These checks provide source validation; they do not replace these signed-in database/browser tests. Deployment and real phone visual acceptance remain unverified.
