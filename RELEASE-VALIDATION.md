# Release validation — 6 October 2026

## Executed locally

Server test suite: 46 tests, 45 passed, 0 failed, 1 skipped. Some inherited tests check module/source presence; they are not end-to-end assurance.

New exercised behaviour includes pure-planner procurement/production/QC/sales flows, partial material/labour allocation, balanced journals, returns, negative-stock and linked-quantity rejection, work-order WIP isolation, reversal dependencies, tenant permission guards, request hashing, email retry/dead-letter/idempotency mocks, encrypted backup cryptography and HTTP health/auth/CORS checks.

Client production build passed. Build reports a large PDF-tools chunk; this is a performance warning, not a build failure. Server JavaScript syntax checks are included in final packaging verification.

## Not executed / deployment blockers

- Real MongoDB replica-set integration suite was skipped: no TEST_MONGODB_URI available. Transaction contention, retry and rollback logic need this actual database run.
- Razorpay capture/refund and Resend sending were tested with mocks, not real provider sandbox accounts.
- No live tenant migration, actual encrypted export/restore drill, hosted browser login journey, load test, penetration test or accountant sign-off was performed.
- No live GitHub push or Netlify/Render deployment was performed for this release.

## Staging acceptance checklist

1. Run all server tests including the real database suite. Create two companies and two factories; prove cross-company/factory reads and writes fail, including document IDs and support URLs.
2. Verify owner bootstrap, company ID/user ID login, weak password rejection, reset email/token expiry, disabled users and session invalidation after permission changes.
3. Reconcile legacy stock snapshot against physical stock and inventory valuations. Trial OPENING and activation on a staging copy; confirm old writes lock and history remains visible.
4. Run purchase → receipt → invoice → payment, sales → invoice → dispatch → receipt and return cases using real database transactions. Confirm stock/GL values and trial balance.
5. Run two BOM work orders, partial receipts and labour costs. Verify no cross-work-order WIP consumption, QC caps and reversal ordering. Confirm required shop-floor workflows fit this version before cutover.
6. Retry identical postings, submit concurrent issues and simulate database failures. Verify no duplicate document or partial stock/journal commit.
7. Capture a sandbox subscription payment; replay webhook and duplicate checkout verification. Confirm one paid term and invoice, correct customer/factory and tax snapshot.
8. Send test invoice emails, exercise failure retries, cancellation/expiry and full refund confirmation. Validate provider status before retrying ambiguous requests; manual payout reference must represent a real payout.
9. Verify billing access after expiry while operational access is blocked. Renew and confirm data retention plus cancellation/refund boundaries.
10. Pause staging writes, encrypted export, validate/tamper/wrong-key checks and restore into an empty target. Verify identifiers, dates, record counts and operational relationships; configure independent managed backups.
11. Review invoice legality/tax calculation, audit permissions, database credential access, retention policy and monitoring with the responsible professionals/operators.

Only after these checks should the candidate replace a production installation. Platform operator API restrictions do not eliminate infrastructure administrator access.
