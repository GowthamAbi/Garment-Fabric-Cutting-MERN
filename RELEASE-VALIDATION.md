# Release validation — 9 October 2026

This extension supersedes the older consolidated source ZIP. Read DEPARTMENT-RELEASE-START-HERE.md first. It is not deployed and has not been certified as production ready.

- Node runtime: v24.19.0.
- Server suite: 71 tests, 68 passed, 0 failed, 3 skipped.
- Skipped tests require a real transaction-capable MongoDB TEST_MONGODB_URI: existing core ledger, shop-floor concurrency, and new department partial inward/checking/sale-return/rollback scenario.
- Client production build passed: 2,061 modules. Existing PDF chunk exceeds the 500 KB advisory.
- Server source/script syntax check passed (193 files, plus final changed department/service files rechecked).
- Local anonymous HTTP checks cover core ERP endpoints; department business routes remain behind existing authentication and subscription middleware. Database-backed authentication/department/shop acceptance has not been executed.
- New policy tests exercise piece precision, checking conservation, operation sequencing and cycles, packing capacity consumption, GST/no-tax arithmetic, demand suggestion, department licensing, owner denial and cashier shop scope.

Not executed: real DB transactions/concurrency/recovery, company provisioning and provider email delivery, online payment/refund, browser interactions, QR printing/scanning on devices, GST statutory compliance, encrypted restore/load testing. Run staging acceptance before live deployment. The new database test is present, not evidence that it passed.

Read the current department guide for implemented flows and limits, including reviewed core-stock handoff, independent demand approval, general movement undo requiring unused outputs, and excluded automatic legacy challan conversion/shortage adjustment. Existing historical milestone files describe earlier releases and are not current validation claims.

Company activation update: mocked provider acceptance/rejection and configuration/public-URL checks pass. Live Resend delivery and database-backed duplicate provisioning remain untested. Frontend build passed after company-list changes.
