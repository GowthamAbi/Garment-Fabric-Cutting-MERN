# Ramraj company admin — findings and fixes

13 October 2026. Target: https://ugsaas.com/c/ramraj/login

## Live inspection status

Authenticated live company-owner session confirmed. All 14 department tabs opened and displayed their corresponding workspaces/forms. This verifies navigation, not every posting/report workflow.

| Live test | Result |
|---|---|
| Vendor create and edit | Saved VEN-0001, QA TEST ONLY 20261013-1855; QC updated to QA TEST VERIFIED and visible in table. |
| Variant SKU master | Saved QA-FAB-20261013, QA Fabric SKU Test Only, KG / RAW / FABRIC, minimum quantity 0.001. |
| SKU minimum quantity 0 | Rejected incorrectly. Fixed server normalization with regression coverage; live deployment pending. |
| Fabric master/inward owner controls | Missing in live UI. Source omitted company_owner. Fixed owner controls without changing server authorization. |
| Warehouse dummy master | QA-WH-20261013 rejected: ERP activation required. No warehouse record persisted. |
| Department user selection | All 14 available for Department Data Entry; empty user form required Name. No account/permission grant submitted. |
| Notification bell | Live overlap behind trial notice confirmed. Previously pushed portal fix is not yet visible live. |

Only the two labelled QA masters above remain. No opening stock, production movement, payment, permission grant or ERP activation was submitted. Initial Failed to fetch alert was also observed; cause remains unresolved.

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

## Remaining acceptance checklist

- Verify subscription, enabled departments, ERP activation, assigned factories and administrator permissions.
- Navigation of all 14 completed. Posting requires reviewed ERP activation; verify each workflow after setup.
- Create uniquely labelled QA masters and dummy entries, then verify save/reload/edit, stock conservation, history, reports and prints.
- Review/create a test department user, assign only the intended department/factory permissions, then sign in as that user and verify both allowed and denied access.
- Verify notification popup stays above subscription notice at phone/tablet/desktop widths, dark theme, scroll and keyboard Escape.
- Test partial production handoffs, duplicate submissions, stock limits, exports and QR/print.

Validation: 168 server tests — 161 passed, 0 failed, 7 database scenarios skipped. Production build and both static layout render checks passed. Sidebar access refreshes when changing pages so trial/payment configuration does not remain stale. These checks provide source validation; they do not replace these signed-in database/browser tests. Deployment and real phone visual acceptance remain unverified.

## Additional fixes from authenticated testing

- Include company_owner in fabric master management, fabric inward entry, cutting actual edit and garment master administrator controls. Existing server entitlement/role checks remain authoritative.
- Accept zero/blank minimum SKU quantity as zero; reject negative and excessive precision. Stock movement quantities remain strictly positive.
- Return ERP activation state in the department catalogue and show a setup message with disabled save buttons before rejected submissions.

Live desktop forms currently have very pale table headers, dense navigation and uneven spacing. Company layout changes already pushed need deployment and phone/tablet visual verification. Payment capture/approval, renewal email delivery, user isolation, stock conservation, exports and all production handoffs are still unverified in this company. Do not mark the ERP fully accepted until these checks pass.
