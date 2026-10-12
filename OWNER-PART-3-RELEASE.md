# Owner Part 3 — subscription purchase and invoices

## Implemented
- Company creation on a paid plan now creates PaymentPending operational access. Verification still permits sign-in to billing. Approved Trial has the existing seven-day expiry; paid provisioning has no purchased expiry until settlement.
- Activation and resend emails explain verification, sign-in, trial/package purchase and invoices. Email verification does not grant a paid entitlement.
- Owner plans support FIXED (package base), PER_USER (user rate × seats), PER_DEPARTMENT (department rate × count) and COMBINED (base + both rates), plus setup fee and configured tax. Trial name/code are reserved together.
- Subscription Purchase selects seats and licensed departments. Authenticated server quotes calculate integer paise and enforce package limits. Checkout recalculates the quote and freezes its selected features, amounts and validity in the billing record. Active-user counts and occupied departments are checked before purchase and again inside settlement; company revision serializes against user provisioning.
- Existing captured-payment matching, webhook idempotency and transaction settlement remain the activation path for online payments. Manual requests still require explicit owner approval. Pending/failed orders grant no new paid access. Valid existing trial/paid access remains available until its own expiry.
- Paid settlement applies only purchased departments/seats and explicit ERP features. It generates the invoice and queues invoice delivery within the existing settlement transaction. Duplicate settlement returns the existing invoice.
- Activation controls cannot assign arbitrary validity or activate unpaid packages. Validity comes from approved trial or settled payment evidence.
- Profile includes company subscription invoice history/PDF. Owner company details show central billing history and the immutable invoice snapshot saved at new settlement, without reading customer operational records. No-GST PDF heading is Invoice rather than Tax Invoice.
- Billing metadata and active-user checks span company factories while retaining company/tenant scoping. Paid-pending and expired owners are directed to Subscription Purchase after sign-in.

## Validation
Server: 135 tests, 131 passed, 0 failed, 4 skipped (real database acceptance prerequisites absent). Frontend production build passed. Added tests cover pricing models, paise rounding, selected features, invalid selections, occupied-department/seat downgrade rejection and paid-pending access denial.

## Acceptance still required
No live email delivery, captured Razorpay payment/refund, MongoDB replica-set transaction/concurrency test, logged-in device acceptance or accountant-reviewed GST invoice was performed. Configure/verify Resend sender, public CLIENT_URL, Razorpay keys/webhook/worker and supplier billing/GST fields, then run those checks before commercial rollout. Existing Vite large-chunk warning remains.

## Compatibility and boundaries
- Existing subscription contracts and pending billing records retain their prior snapshots. Quote version 1 applies to new orders only. This release does not retrospectively revoke companies that were previously marked Active; review those against actual payment records before rollout.
- Historical invoices without a central snapshot remain in company Subscription Bills. Owner central history shows only snapshots created by new settlements; no automatic operational-data backfill occurs.
- Existing manual approval is retained as an explicitly reviewed alternative to online payment; it is not automatic payment evidence.
- Rates and tax classification are configurable inputs, not a statutory certification. Setup fee is charged on each purchase, matching prior behavior. Invoice delivery is queued, not a guarantee of inbox delivery.
- Department removal with active assigned users is rejected; reassignment and existing stock/workflow impact need a reviewed downgrade process. Routing and standalone department boundaries remain Parts 4–5.
- Pending paid provisioning stores requested company department metadata but cannot access subscription-gated operations. Email configuration failure remains visible/retryable and does not roll back company creation.
