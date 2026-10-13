# Live acceptance: prerequisites and provider evidence checker

The operational ERP implementation and acceptance checklist are in Parts 1–10. This addition verifies existing provider evidence; it does not replace full business workflow testing.

## Read-only provider checks
Run from server: `node scripts/verify-provider-evidence.js`.
Set credentials privately in server/.env or the staging environment, not in Git or chat:
- RESEND_API_KEY with permission to retrieve sent emails.
- ACCEPTANCE_ACTIVATION_EMAIL_ID, ACCEPTANCE_RESENT_EMAIL_ID, ACCEPTANCE_RESET_EMAIL_ID: IDs of existing staging messages generated through the application.
- RAZORPAY_KEY_ID beginning rzp_test_, RAZORPAY_KEY_SECRET.
- ACCEPTANCE_CAPTURED_PAYMENT_ID, ACCEPTANCE_FAILED_PAYMENT_ID, ACCEPTANCE_REFUNDED_PAYMENT_ID: existing test-mode payment IDs.
- Optional ACCEPTANCE_PROVIDER_REPORT: new private report file path. Existing files are not overwritten.

Only GET requests are made. Response bodies, addresses, link tokens, provider IDs and credentials are not printed. Missing configuration is PENDING and exits non-zero. Provider rejection reports HTTP status; connectivity errors are sanitized.

Email must have last_event delivered. Sent/queued alone does not prove delivery; later opened/clicked events conservatively remain pending and require delivery event review. Provider delivery means recipient mail-server acceptance, not guaranteed inbox placement.
Captured payment must have captured=true, status captured and a valid positive integer INR amount. Failure must have status failed. Refund check requires status refunded and amount_refunded equal to original amount (full refund scenario); partial refunds need their own scenario review.

Sources: https://github.com/resend/resend-openapi/blob/main/resend.yaml and Razorpay payment API documentation. Read permission is required; a sending-only Resend key may reject these GET checks.

## Remaining execution requirements
- Private disposable TEST_MONGODB_URI pointing at a replica set/Atlas test cluster; never production. Run scripts/acceptance.py --require-database as described in Part 10.
- A staging website URL and authorized test login via a secure account connection. Two company/factory scopes are required to exercise isolation through the UI.
- Test-mode checkout and email messages must be created through the real application before evidence can be selected. Verify token one-time use, package/expiry access, webhook duplicate handling and refund reconciliation separately.
- Full Fabric→Shop sale/return sample order and ledger reconciliation; existing legacy/core boundaries remain as documented, not silently merged.
- Enrolled offline device, real reconnect and browser/mobile sessions; code render checks do not prove these.
- Encrypted backup plus isolated restore destination; use the guarded restore-drill script.
- Accountant review of payroll/GST and actual physical QR print/scan. No script can substitute for physical print acceptance.

## Validation this update
151 server tests passed, 0 failed, 7 real database tests skipped. Provider checker without keys/IDs returned PENDING and exit 1 as expected. No live messages, payments, refunds or database changes were performed.
