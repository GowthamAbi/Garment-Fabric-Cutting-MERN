# UG SaaS ERP — Plans 5–10 release candidate

This package includes the current repository and the updates from Plans 1–4 plus the following production-to-retail and planning changes. It is a code release candidate, not a verified live production deployment.

## Scope and status

| Plan | Included implementation | Acceptance still required |
| --- | --- | --- |
| 5 | Costed CUT_PANEL_RECEIPT to CUTTING after completed Folding; shared work-order receipt caps; receipt reversal ordering; reusable stitching operations and partial section inward | Real staging work-order/cutting/delivery run and confirmation of BOM structure |
| 6 | Existing repeated checking/rework/oil cycles, QR bundle trace, ironing and packing; operator/shift trace; new physical bundle/ledger reconciliation | Real defect cycles, partial receipts and packing rollback test |
| 7 | Existing two-step dispatch/warehouse/shop allocation, shop permissions, sales invoices with/without configured GST, returns and stock/accounting entries | Real two-shop transfers, sales and refunds; company invoice/tax review |
| 8 | Daily UTC sales buckets, blended baseline/EWMA forecast, variability safety buffer, service-level selection, sparse-history labels; reviewed demand-to-work-order allocation | Backtesting against actual sales, stockouts and promotions |
| 9 | IndexedDB cash-sale draft queue scoped to company/factory/user; online identity verification and idempotent sync; reviewed payroll rule versions, calendar proration, employee/employer contribution calculations; immutable payslips and transactional salary accrual/reversal | Browser offline/network-loss tests and real replica-set payroll concurrency; accounts review of configured contribution rules |
| 10 | Automated suite, build, syntax/import checks, source conflict checks and consolidated source ZIP | Live Atlas migration/tenant isolation, real Razorpay capture/failure/refund and deployed browser acceptance |

## Production handoff

1. Activate the factory ERP ledger after reviewing opening balances. Use variant SKUs for colour/size, with whole-piece units PCS/PC/PIECE/PIECES.
2. Create a work order and reviewed production BOM. For departmental handoff, the cut-panel BOM must represent the materials/costs consumed before delivery; packing accessories are separately consumed by the packing master. Do not put the same packing consumption in both places.
3. Issue BOM materials to that work order. Create the shop-floor route and complete Cutting then Folding. Elastic remains optional in routing.
4. Post CUT_PANEL_RECEIPT referencing the work order. It consumes allocated WIP materials/costs, creates CUTTING stock and respects completed Folding capacity. CUT_PANEL_RECEIPT and traditional PRODUCTION_RECEIPT share the work-order output cap; the same output cannot be received twice.
5. Create versioned stitching and packing masters, then send CUTTING stock using section/DC/order details. For new production use cut-panel receipt rather than unreviewed opening stock. Existing FINISHED-stock reprocessing remains available as a reviewed legacy input.
6. Advance partial bundles through saved operation names. STITCHED inward increases original received quantity only by the actual inward pieces. Rework return cycles do not increase original DC received quantity again.
7. Checking splits conserve pieces. Good moves to ironing; rework/oil return to checking and may repeat; waste is separately tracked/disposed with administrator approval.
8. Packing consumes size/SKU-specific accessories and moves accumulated stock value into packed bundles. Dispatch and warehouse/shop receipts support partial quantities. Retail returns go back to checking.
9. Administrators can open factory reconciliation to compare all department bundle quantities with the stock ledger and review section pending totals. No automatic discrepancy write-off occurs.

## Forecasting

Choose Forecast with variability buffer in Marketing analysis. The estimate blends full-window daily mean with recent exponential smoothing (alpha 0.2), calculates a variability safety buffer and subtracts shop stock/transit. The 90/95/99 selections are planning assumptions, not a guaranteed achieved service level. Missing-sales days are zero; returns reduce their original sale day. Dates use UTC. This is an explainable baseline forecast, not promotion-aware machine learning or stockout-adjusted demand. Suggestions never automatically create orders.

## Offline POS behavior

- Load and keep the authenticated shop page open before disconnecting. The application is not a cold-start offline PWA; refreshing or closing while offline can require reconnection.
- Offline cash-sale drafts persist in IndexedDB and survive tab closure, but stock/catalog and authenticated workspace are not cached for offline reopening.
- Drafts exclude customer contacts, passwords and tokens. They contain product/price information and are accessible to someone with access to that browser profile.
- Drafts are provisional: no confirmed invoice, reservation or final stock posting exists until server sync succeeds. Last-known stock is checked locally against this user's drafts, then current stock is checked transactionally by the server.
- Sync verifies the same online company/factory/user. Original immutable keys are reused, including after an uncertain network response. Conflicts are shown for review; retry uses the same payload/key. Bank payment and offline refunds are not enabled.
- Keep unresolved drafts until reconciled. Removing an uncertain draft requires checking whether the server already posted it. Device clearing/uninstall can remove browser drafts; this is not a durable server backup.

## Payroll and accounting

Company admins create immutable rule versions with an approval/reference, effective months, PF basis, contribution rates in basis points, caps/eligibility thresholds, and explicitly configured employee/employer rates. No statutory rates are automatically assumed.

Accounts enter reviewed monthly basic/allowance, paid days (whole or half days), overtime, tax and other deductions. Calendar proration uses the actual month length. The ESI eligibility test uses unprorated monthly basic plus allowance; the company must review whether this configured basis/rule applies. Rule-based payslips retain the calculation/rule snapshot. Professional/income tax, filing, remittance and employee-specific statutory coverage are not automated.

Payslip creation is separate from salary payment. Company admins with ERP Finance can post a salary accrual after typing POST PAYROLL. The entry debits salary expense including employer contributions and credits net salary payable plus contribution/deduction liabilities. Duplicate requests return the same document. Accrual/reversal/void serialize through the factory ERP lock. An active accrual must be reversed through Workforce before voiding the payslip; generic ERP reversal is blocked for payroll-managed documents. Salary payment and statutory remittance require separate reviewed accounting entries.

## Local validation

- Server test suite: 108 passed, 4 skipped, 0 failed.
- Client Vite production build: passed. Existing large PDF-tools chunk warning remains.
- Server app import and modified server syntax checks: passed.
- Real database tests are optional and were skipped because staging database credentials were not available. The department integration test now includes repeated rework/oil cycles, original-DC pending conservation, retail transfer/return reconciliation and payroll accrual/retry/reversal/void.
- IndexedDB/UI behavior was not verified in a deployed browser; Node tests cover offline draft validation/scope and exclusion of customer contacts.

Run from repository root:

```sh
npm install --prefix server
npm install --prefix client
npm test --prefix server
npm run build --prefix client
```

For staging database acceptance, configure TEST_MONGODB_URI and TEST_CUSTOMER_MONGODB_URI privately in the test environment and rerun the suite. Use dedicated staging principals/clusters: these tests create and clean up generated test databases. Do not paste connection strings into chat or commit them.

## Deployment and release gate

Preserve the existing production MONGODB_URI, JWT/configuration secrets, HTTPS frontend URL, CORS origins, verified Resend sender and Razorpay webhook configuration. Plan 4 customer-owned databases additionally require a stable private 64-hex-character TENANT_CREDENTIAL_KEY, Atlas permissions/network access and backups. Deploy both frontend and backend from the same reviewed commit.

Before production approval, verify real: tenant A/B isolation and support grants; Atlas migration/recovery and restore; activation/reset delivery; trial expiry and plan features; captured-only payment entitlement; failed/duplicate payment handling; full production-to-shop quantity/value conservation; offline uncertain-response retries; configured payroll rates and invoice fields. No actual customer data was migrated and no real payment/email was sent as part of this release.
