# Part 9 — Final source release and acceptance status

This source release includes Owner Parts 1–8 and Part 9 packaging. It is a staging acceptance candidate, not certification that all production workflows or integrations passed.

## Verification on 12 October 2026
| Check | Result |
| --- | --- |
| Server automated tests | 148 passed, 0 failed, 7 skipped (155 total) |
| Frontend production build | Passed; existing large-chunk warning remains |
| Company / SaaS owner layout render smoke | Both passed |
| Public live API health and database readiness | Both responded successfully; authenticated owner queue monitoring not run |
| Merge conflict marker scan | Passed |
| Source manifest and ZIP integrity | Verified by package-release.py |
| Live transactional database acceptance | Not run; TEST_MONGODB_URI unavailable |
| Resend delivery and Razorpay capture/refund | Not run; staging credentials unavailable |
| Logged-in desktop / physical mobile / Safari acceptance | Not run |
| Live backup restore, QR print, GST invoice review | Not run |

## Run locally / staging
1. Extract ZIP. Install Node dependencies using `npm ci --prefix server` and `npm ci --prefix client` (lockfiles supplied).
2. Copy server/.env.example to server/.env and client/.env.example to client/.env. Fill actual private credentials locally; never commit them.
3. Use an isolated transaction-capable MongoDB replica set/Atlas cluster. Review migration and index changes before pointing at existing data.
4. Run `npm test --prefix server`, then `npm run build --prefix client`. For real database tests set a disposable TEST_MONGODB_URI using the fixture requirements in server/tests. Do not point tests at production.
5. Start API with `npm start --prefix server` and client with `npm run dev --prefix client`. Verify API origin, CORS and HTTPS deployment settings.
6. Owner setup: follow server/scripts/bootstrap-owner.js and its documented environment controls. No public default password is supplied.
7. To verify/package this source again: `python scripts/package-release.py --output ../UG-SaaS-ERP.zip`.

## Mandatory staging acceptance before commercial rollout
- Two companies and two factories: user creation, factory switch, permission denial, cross-company isolation; customer-owned database migration and recovery.
- One full sample order: Fabric → Cutting → Delivery → Stitching → partial Inward → Checking (good/oil/rework/reject) → Ironing → Packing → Dispatch → Warehouse → Shop → Sale/Return. Reconcile each quantity and ledger.
- Two simultaneous receipt/cancellation posts, duplicate retries, rollback on errors and no negative stock.
- Activation, resend and password reset: delivered email with the correct company HTTPS URL, expiry and one-time use. Diagnose provider rejection without exposing tokens.
- Razorpay test-mode success/failure/pending/refund/webhook retries: captured payment grants only selected entitlements and duration; expired trials/subscriptions lock operational access.
- Offline POS enrolled device: reopen offline, cash sale and provisional receipt, reconnect duplicate-safe sync, logout/passphrase protection and stock reconciliation.
- Forecast scenarios: season/promotion/stockout inputs, insufficient-history behavior and forecast vs actual. Forecast outputs need business validation.
- Payroll: accountant checks PF/ESI/TDS rules, statutory outputs and filing/remittance evidence; preparation tools do not mean automated government filing is complete.
- Chrome/Firefox/Safari and physical mobile: dark/light, profile help, keyboard, menu, table overflow, logout/inactivity and no private page/API without login.
- Print physical QR, invoice with/without GST, verify tax details with an accountant. Run restore-drill.js only into its isolated empty drill database.
- Schedule jobs/monitoring externally, test alert delivery and practice deployment rollback. Rollback code alone does not roll back database migrations.

## Known scope limits carried forward
- Parts 4–7 release notes describe standalone boundaries, downstream-only routing, core-document approval limits and retained PO closure. Do not infer complete conversion of all legacy screens.
- Legacy and core PO datasets remain separate. Factory/location retirement is not implemented.
- Infrastructure credential holders can access databases; application restrictions alone cannot guarantee infrastructure-level owner exclusion or prevent every data loss.
- Browser visual and live integration gates above remain pending. Complete them and retain evidence before marking production ready.
