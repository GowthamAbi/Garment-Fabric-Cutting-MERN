# Plan 3 — payment activation

Existing signed captured webhook and transactional settlement retained. Checkout verification alone never activates access. Added strict provider order ID/INR/amount validation, provider timeout, paired payment/billing creation transaction, failed order state, explicit frozen duration/entitlement validation, and paid package ERP_CORE requirement. Configure positive real prices; Trial is owner approval only.

Trial-to-paid term begins at settlement; no unused trial-day bonus. Existing paid renewals retain remaining paid days. Settlement no longer falls back to mutable plan limits/duration. Legacy billing without snapshots requires reconciliation before settlement. Duplicate captured events share a unique queue key and settlement retains its one-invoice/one-term checks.

Added company-scoped payment status API and checkout pending polling up to one minute. Failed/cancelled checkout does not extend entitlements. Poll timeout asks customer to check history before paying again; worker may still settle later.

Render: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET and AUTOMATION_ENABLED=true. Razorpay webhook URL: https://api.ugsaas.com/api/webhooks/razorpay ; select payment.captured. Configure matching test/live credentials and auto capture in provider settings. No keys in source.

Required staging checks: Razorpay test payment success/failure/cancel, delayed/duplicate webhook, worker retry, exact purchased term/features, single invoice, real MongoDB transaction rollback. Local mocks/policy/build tests do not verify live financial settlement. No charge or live provider action performed.
