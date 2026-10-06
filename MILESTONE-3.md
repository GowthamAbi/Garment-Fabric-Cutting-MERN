# Milestone 3 — unified subscription settlement

Includes Milestones 1 and 2. This is a staging candidate, not a complete production ERP.

Manual approvals and signed Razorpay capture webhooks now use one MongoDB transaction service. Billing status, tenant payment, company expiry, tenant registry and invoice commit together. Already-settled requests return the existing payment/invoice without extending expiry. Inconsistent legacy records are rejected for reconciliation. Manual approval cannot activate Razorpay requests.

Checkout signature verification no longer activates subscriptions: it returns HTTP 202 pending capture, and the UI explains this. Configure the signed payment.captured webhook; otherwise online payments stay pending. Renewals preserve unused paid days. Invalid durations/expiry dates fail settlement.

## Validation

28 local tests pass, including renewal boundary and invalid-date tests. These include policy/unit and existing source checks; they do NOT prove real database transaction isolation. Frontend build and syntax checks are run with this package.

## Required staging checks

Use a disposable Atlas replica-set database and Razorpay sandbox. Replay identical captured events and simultaneous manual approvals; verify exactly one invoice and one expiry extension. Force invoice failure and confirm all settlement writes roll back. Verify wrong amount/currency/order and alternate payment IDs are rejected. Confirm checkout stays pending until capture. Reconcile any historical partially-paid records before launch.

No live database credentials were used, and no live deployment was performed. Refund workflows, durable webhook inbox/retries, email outbox, encrypted backup/restore, unified stock ledger and full accounting remain pending.
