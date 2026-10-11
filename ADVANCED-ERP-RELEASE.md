# Advanced ERP release candidate

## Delivered code
1. Marketing scenario forecast combines recent demand, weekday seasonality (minimum four observations per weekday), reviewed promotion/season multipliers and explicit stockout-day imputation. It returns daily horizon, safety buffer and replenishment after stock/transit. Zero sales are not assumed to be stockouts. Dates/multipliers entered in one analysis apply to the selected report's entire shop/SKU set; use only dates applicable to that set. Annual seasonality is a planner input, not an automatically fitted annual model.
2. Offline cold-start cash POS at `/offline-pos/`. Online Shop users enroll an encrypted, minimal bundle catalog with a 16+ character device passphrase. Catalog expires after 24 hours. The isolated service worker caches only its own shell/modules/styles, never API responses or authentication tokens. Reopened terminal unlocks offline, saves cash drafts to IndexedDB and prints a provisional receipt. Read/write draft reservations serialize across tabs. Live inventory can still differ on other devices.
3. Online Shop reconnect checks the original company/factory/user session before retrying immutable sale keys. Conflicts pause for review; accepted transactions produce the server invoice. The offline-only shell does not store authentication or post automatically: open the signed-in Shop department to sync. Expired subscriptions, changed roles and changed live stock can reject drafts; reconcile collected cash before removing them.
4. Reviewed PF/ESI/TDS contribution report/export and immutable per-period/kind register. The report requires rule-based payslips with unreversed salary accruals. A different administrator checks matching payroll snapshot, amount, portal filing and bank payment references before recording them. Rejected packs retain history and permit a corrected pack. This register is evidence tracking, not an automatic GL settlement or provider-confirmed payment.
5. Read-only `server/scripts/operations-probe.js` checks HTTPS health/readiness and owner email/payment queue thresholds. Configure MONITOR_API_URL, private MONITOR_OWNER_TOKEN and optional MONITOR_MAX_PENDING_SECONDS. Schedule externally; its non-zero exit must be connected to your monitoring provider's alert channel. No alert delivery has been configured or tested here.

## Build and use
- Server: `cd server`, `npm install`, `npm test`; production start remains `npm start`.
- Client: `cd client`, `npm install`, `npm run build`. The build emits shared offline draft/receipt modules. Test offline mode using the built preview or HTTPS deployment; the development server does not emit those build assets.
- Netlify uses the repository's `netlify.toml`, including offline page rewrites and CSP headers. Successful GitHub push is not evidence of successful Netlify/Render deployment.
- Enroll while online, open Offline POS once, disable networking, reload and unlock, create/print a draft, reconnect and synchronize from the same online Shop user. Confirm exactly one final sale/invoice and correct stock after repeated retry. Clear catalog on shared-device decommissioning; retain unresolved drafts for reconciliation.

## Verification
Server: 117 passed, 0 failed, 4 skipped (121 total). Frontend production build passed. Pure tests cover stockout scenarios, weekday seasonality, provisional paise totals, statutory report prerequisites, and device encryption/wrong workspace/tampering/expiry.

Browser offline installation/IndexedDB interactions, physical printing and live integrations have not been exercised. There is no browser runtime or Resend/Razorpay/staging MongoDB configuration in this workspace. Four real database tests remain skipped; static/pure tests are not a replacement for them.

## Production acceptance still required
| Check | Required environment/evidence |
| --- | --- |
| Activation/resend/reset | Verified Resend sender, private API key, public CLIENT_URL, delivered messages and valid one-use links |
| Payment/refund/expiry | Razorpay test-mode configuration, webhook secret, captured/failure/refund events, unchanged access after failed payment, exact paid entitlement duration |
| Company isolation/concurrency/rollback/migration | Dedicated replica-set staging URI as TEST_MONGODB_URI; customer-controlled Atlas migration candidate; run opt-in tests and inspect routing/counts/hashes |
| Fabric to shop sale/return | Sample variant order, valued opening stock, linked partial challan, all checking cycles, accessories/dispatch/transit/shop/return, balanced physical and GL totals |
| Restore | Encrypted offline export, independent authorized staging target; run `node server/scripts/restore-drill.js BACKUP_FILE` with DRILL_MONGODB_URI, DRILL_DATABASE_NAME, DRILL_CONFIRMED=YES, BACKUP_COMPANY_KEY, BACKUP_PASSPHRASE. Retain report and restored target. Customer-owned Atlas snapshots need their separate recovery procedure. |
| Payroll filing/remittance | Accountant-reviewed eligibility/rules and approved filing/provider requirements. Official ECR/ESIC/TDS submission adapters, EPS/EDLI/administrative components and automated TDS tax computation are not implemented. Current TDS is a reviewed manual deduction. |
| Invoice/GST and QR | Accountant review of tax profile/rates/numbering/returns, real QR label and receipt printer checks |
| Backup protection and alerts | Least-privilege customer credentials, independent protected backups, scheduled monitor and verified alert delivery |
| Deployment rollback | Record last accepted application commit and data schema compatibility. Redeploy that commit in staging and verify readiness/session/stock. Never roll back by deleting databases or undoing financial migrations blindly. |

No live email/payment requests or database migrations were run in this release. Configure secrets privately; do not paste them into chat. This release does not claim all production acceptance or government filing integration is complete.
