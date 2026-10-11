# ERP operational controls release

This is a release candidate, not a production acceptance certificate.

## Implemented in this increment
- Issued legacy challan lines link to stitching lots with explicit colour/size SKU mapping, partial quantity caps and cancelled-lot exclusion. Completed cutting/folding and reviewed CUTTING stock are prerequisites. No automatic unvalued opening stock is created.
- Company administrators can inspect item/colour/size/section/operation WIP, operator/shift output, daily targets, bundle aging and inspection-attempt defect rates (rechecks count again).
- Warehouse rack/bin masters and partial relocation; missing/damaged count requests require a different administrator and an unchanged stock snapshot before approval. Excess counts require a separately reviewed source.
- Labour/jobwork bill-line allocation distributes every paise across all remaining pieces, posts inventory cost and AP/cash/bank, rejects duplicate references and allocations after quantity losses/sales.
- Owner-only GET /api/saas/operations-status exposes central queue counts, failed activation counts, migration counts and configuration presence without customer operational data or credentials.
- Encrypted offline backup restore drill in server/scripts/restore-drill.js. It refuses existing databases and retains restored records for inspection; TTL indexes are not enabled in the drill.

## Restore drill
Use only encrypted exports from server/scripts/tenant-backup.js, not the application's JSON download. Configure private environment values FILE, DRILL_MONGODB_URI, DRILL_DATABASE_NAME (ugs_restore_drill_ plus 4–35 lowercase letters/numbers/underscores), DRILL_CONFIRMED=YES, BACKUP_COMPANY_KEY and the encryption settings required by the export. Inspect the script for the complete validation contract. Run node server/scripts/restore-drill.js against an isolated, authorized staging cluster. It does not delete data, switch tenant routing or replace a production database. Customer-owned Atlas backup recovery needs its separately controlled snapshot/export process.

## Verification performed
- Server: 112 passed, 0 failed, 4 skipped (116 total).
- Frontend production build passed.
- Application import and restore script syntax passed.
- Real MongoDB transaction tests were skipped; these results do not establish concurrency/isolation acceptance.

## Still incomplete or unverified
- Fully automatic legacy stock/valuation migration and historical opening-balance acceptance.
- Seasonal, promotion and stockout-aware forecasting.
- Offline cold-start POS, cached catalog and provisional receipt lifecycle.
- Jurisdiction-reviewed statutory payroll filing/remittance integrations.
- Live email delivery, captured payment/refund and subscription-expiry acceptance.
- Real isolation/concurrent posting/rollback tests for every new workflow.
- Independent protected backups, least-privilege infrastructure, executed restore drill, external alerts and deployment rollback exercise.
- Full Fabric-to-Shop-sale/return stock/accounting reconciliation, invoice/GST accountant review and physical QR printing.

No live provider credentials or customer databases were used during this verification. Never paste connection strings or API secrets into chat.
