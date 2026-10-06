# Milestone 2 — support and payment security

Support tokens are checked against live customer-approved scopes at authentication.
Only approved GET endpoints are allowed; reads are audited before processing.
Support code redemption is atomic and single use. Revoked/expired grants deny requests.
Current permissions and department are refreshed from the database on each session request.
Async authentication errors are now caught.

Captured Razorpay payments require configured secret, raw-body signature validation,
matching order, INR amount and captured status. Payment, subscription, invoice and billing
settlement are grouped in a MongoDB transaction. Retries of a paid billing request do not
extend its subscription again. Active subscriptions renew from their future expiry date.

Limitations: real replica-set transaction replay/concurrency/failure testing is pending.
Manual approval and browser verification settlement paths still require consolidation
into the transactional settlement service. Refund workflows, durable event records,
email outbox, encrypted backups and stock ledger are not implemented in this milestone.
Do not describe this as complete production payment certification.

Test in staging with MongoDB Atlas/replica set and sandbox Razorpay before live use.
Reconcile legacy partial settlements and central invoice numbering before deployment.
