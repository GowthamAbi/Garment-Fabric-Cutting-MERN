# Owner console audit fixes — 13 October 2026

The audit found inconsistent workspace counts, company-scoped subscription screens in the platform owner console, misleading unavailable factory/user totals and weak form/layout feedback.

## Changes

- Dashboard and Sales use the central registry count and label it Active Workspaces. This means provisioned registry status ACTIVE, not captured payment or current operational entitlement.
- Customer user counts and factories are labelled company managed, rather than claiming zero users or no factory from missing registry fields.
- Owner Subscriptions selects a registered company and reads its central billing requests/invoice snapshots using the existing owner billing endpoint. The hard-coded Basic/Professional upgrade form is no longer shown to the platform owner.
- Owner Payments reads central BillingRequest IDs, so Approve targets the IDs expected by the settlement controller. It resolves company display names and exposes tax/setup totals without returning the full quote/entitlement snapshot.
- Owner Users now explains account scope and links to Owner Settings/Companies. It no longer offers a company-role creation form without a company context. Customer User Management is unchanged.
- Plans separates capacity from licensed coverage, displays supported department limits and preserves capacity when coverage checkboxes change. Numeric bounds match existing server constraints for monetary amounts, tax and department limits. Plan save and payment approval show pending state and disable duplicate clicks.
- Company creation is collapsed by default so the company list is easier to reach.
- CRM has pending-save feedback, cancel edit, empty-filter feedback and disabled contact activity buttons when contact details are missing. No external messages are sent by these changes.
- Owner-only CSS uses consistent fonts, restrained cards, aligned forms, focus indicators, scrollable tables and one/two-column mobile/tablet rules. Print document styling is unaffected.
- Navigation has labelled close control and current-page semantics.

## Verification

Server tests: 163 total, 156 passed, 0 failed, 7 skipped. Includes a new mocked controller regression verifying owner billing does not require a login-company ID, preserves approval IDs, resolves company names and excludes full quote data.

Client production build passed. Existing index/PDF chunk-size advisories remain. Server controller syntax and git whitespace checks passed.

The seven skipped database scenarios require dedicated replica-set staging credentials. No production database, hosting settings, email worker or provider keys were changed.

## Staging acceptance still required

Deploy frontend and backend together. Confirm owner dashboard and sales counts agree; company selection does not mix billing histories; pending manual approval targets the central request and settles exactly once; activation/provider receipts are correctly distinguished; Trial and Own Plan coverage/capacity remain independent; form save/reload/edit and numeric limits work; company users remain within their own workspace.

Test 360/390/768/1280px viewports, mobile navigation, keyboard focus, dark theme, long company names, table scrolling, exports and print. Responsive CSS was implemented, but browser visual acceptance is not claimed: the earlier cloud-browser session was blocked by credential-state protection.

Worker Disabled is a configuration state. Configure verified staging email/payment credentials and test the worker separately; source/UI fixes cannot prove external delivery or payment capture.

Existing production plan prices/licences are not automatically rewritten. Review the earlier inactive QA plan and synthetic CRM lead before any cleanup. Do not delete accounts or approve payments merely for UI testing.

This is a reviewed source change, not a production deployment or a claim that every Owner option is perfect.
