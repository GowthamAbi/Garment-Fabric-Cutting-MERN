# UG SaaS — Integrated ERP release candidate

This source package includes milestones 1–4 and the combined integrated ERP and automation work. It is a staging candidate, not a certification of production readiness or feature parity with Zoho, ERPNext or Odoo. Read RELEASE-VALIDATION.md before deployment. Older milestone documents describe historical work; this README and the validation report take precedence.

## Included

- Explicit company database and factory scopes, user-ID login, strong passwords, reset flow, role/grant controls and company-approved support access.
- Variant SKUs, customer/supplier masters, versioned BOMs and reviewed opening balances.
- Purchase order → goods receipt → purchase invoice → payment.
- Quotation → sales order → sales invoice → QC-approved dispatch → receipt.
- Work order → material issue/return → labour/other work costs → partial production receipts → QC release/rejection.
- Department stock transfers, same-item jobwork, waste, sales/purchase returns and dependency-aware reversals.
- Transactional stock/journal/document posting with idempotent retries, integer monetary calculations, weighted-average valuation and work-order-specific WIP.
- Trial balance, profit/loss, balance sheet, party outstanding, stock/control-account reconciliation and individual bank transaction matching.
- Printable ERP documents with company/party billing snapshots; subscription invoices and queued invoice emails.
- Signed payment capture inbox, expiry/reminder jobs, cancellation and owner-approved full refunds, bounded retry/dead-letter monitoring.
- Encrypted tenant backup export/validation/empty-database restore tools.

## Local setup

Use a transaction-capable MongoDB replica set or Atlas staging cluster. A standalone MongoDB server is insufficient. Use a supported Node LTS version; the release was built/tested with the workspace runtime, not on your Render instance.

1. Copy `server/.env.example` to `server/.env`; configure MongoDB, a random JWT secret and exact frontend origins. Never commit secrets.
2. Copy `client/.env.example` to `client/.env`. API URL must end in `/api`; do not append a second `/api`.
3. Install dependencies in server and client using `npm ci`.
4. Run `npm run dev` separately in server and client. Frontend normally uses port 5173; backend 5000.
5. For a fresh installation, privately set OWNER_NAME, OWNER_EMAIL and OWNER_INITIAL_PASSWORD and run `node scripts/bootstrap-owner.js` inside server. Login ID is GOWTHAM2131. No shared/default password is shipped; bootstrap does not reset an existing owner.
6. Create/approve a customer company and company administrator through the owner console. Login using the company's assigned workspace key and user ID. Platform owners cannot open the integrated operational ERP through its APIs.
7. Customer admin opens Integrated ERP, creates masters/BOMs and downloads the legacy stock review snapshot. Physically reconcile quantity and valuation, remove duplicate stock representations, then post OPENING documents. Activate only after review.
8. Grant ERP permissions in User Management; affected users must login again. Owner manages subscriptions, while customer admins manage operational data.

## Migration is an explicit cutover

Legacy stock is not automatically converted into new ledger balances. Export is a review aid, not a costing algorithm. Opening balances require verified unit costs. ERP activation locks writes across the old department workflows, including old production scheduling/machine entry; history remains readable. Use the new posting workflows after activation. Do not activate on a live company before testing required department workflows in staging. Existing database migration must first be dry-run using `npm run migrate:dry`, reviewed and backed up; `migrate:apply` changes data placement.

## Automation setup

AUTOMATION_ENABLED defaults to false. Configure Resend sender/key and Razorpay key/secret/webhook secret, verify them in staging, then enable automation. Webhook endpoint: `/api/webhooks/razorpay`. Server runs one bounded job loop every 60 seconds; `npm run jobs:once` is an optional worker entry point. Avoid running redundant schedulers unnecessarily. Reminders do not automatically charge a card. Manual refunds require a reference for an actual payout performed separately. Online refunds may remain pending and require provider confirmation. Failed jobs need operator review, not repeated new payment requests.

## Deployment

- Render: server root; build `npm ci`; start `npm start`; configure secrets privately. `/health` is liveness, `/ready` verifies database readiness.
- Netlify: client base; build `npm run build`; publish `dist`; VITE_API_URL points to backend `/api`. Existing redirect configuration preserves SPA routes.
- Both hosts must use HTTPS and the exact client origin must be allowed. Verify cookie/session behaviour across your domains.
- Do not overwrite the live database with this ZIP. Deploy to staging first and complete the acceptance checks.

## Verification commands

Inside server run `npm test`; inside client run `npm run build`. To run real concurrency/isolation/rollback tests, privately set TEST_MONGODB_URI to a staging replica set and run server tests again. That test creates and drops only generated test databases; nevertheless use staging credentials. Encrypted backup CLI usage is documented in MILESTONE-4.md and `server/scripts/tenant-backup.js`; pause writes before export and test restore on an empty isolated target.

## Scope and security limits

Application permissions isolate customer operational APIs and require approved support grants. Infrastructure administrators holding MongoDB credentials can still access databases: separate DB names alone cannot prevent that. Enforce least-privilege credentials, managed backups, access logging and operational approval controls. Retention protection in application routes is not immutable storage or a guarantee against administrator deletion.

This release does not include statutory GST filing/e-invoicing, payroll, advanced MRP/capacity planning, serial/roll-level integration into the new ledger, multicurrency, a configurable chart of accounts, automatic bank feed reconciliation or automatic charge mandates. Existing roll/machine modules are historical/legacy after cutover. INR tax entries require accountant review. Post-sale support, data retention duration and backup policy need contractual definition.
