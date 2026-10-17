# Phase 2 — 132 management requirement gap register (17 October 2026)

**Workbook source:** Book1.xlsx exact catalog from `shared/excelRequirementCatalogue.js`. Company Admin **58** and Factory Manager **74** options = **132**. Department Head/Staff **334**, full source **466**.

**Status:** **0/132 management requirements accepted** based on current evidence. This is not a declaration that no existing UI works; it means exact feature behavior, authorization, persistence, responsive print and tenant isolation have not been individually signed off. Even a matched route is only a **candidate**. The 334 department options also remain UNVERIFIED for user acceptance although all 16 department development batches were mapped.

## Triage
- P0 (authorization, approvals, finance, purchasing, stock): **58** management requests.
- P1 (production, traceability, notifications/SLAs): **55** management requests.
- P2 (remaining admin/service/report refinements): **19** management requests.
- Candidate route present in AppRoutes: **88**; no route candidate: **44**.
- Counts by type: ADMIN_SERVICE_AND_REPORT 19; ACCESS_AND_APPROVAL 18; ALERTS_AND_SLA 11; FINANCE_AND_PURCHASE 17; INVENTORY_AND_STOCK 23.

## Critical validation path
1. **P0 authorization and billing**: Company Owner → Company Admin → Factory Manager → Head → Entry Staff; verify each dashboard, delegated permissions, owner approval decisions, account data confidentiality and license gates. Verify attempts from wrong factory/role fail 403/404.
2. **P0 finance and stock**: Invoice source and GL journal document conservation, reversible postings, stock inward/outward and valuation, expenses vs actual supplier payables, bank matching, payroll permission isolation, payment due fallback. Do not infer statutory tax compliance from tax ledger.
3. **P1 cross-department flow**: Fabric → Cutting → Delivery → Stitching → Inward → Checking → Ironing → Packing → Dispatch → Warehouse → Shop; compare physical stock, bundle documents, DC and sales/returns in disposable replica-set; verify partial and duplicate messages.
4. **P1 alerts**: delay thresholds, recipients, browser notification permission, scheduled tasks, no spurious notifications.
5. **P2 print/layout**: 360/390/768/1280 px, B/W prints, multi-row exports, screenshot evidence, company/factory selectors, loading/error states.

## Row-level UAT columns required before acceptance
For each item save: `excel_id`, `actual_page`, `actual_api`, `owner_role`, `factory_scope`, `test_data_id`, `expected`, `actual`, `pass_fail`, `screenshot_link`, `git_sha`, `reviewer`, `timestamp`. Do **not** change `sourceStatus` from UNVERIFIED on menu presence alone.

## Full Company Admin and Factory Manager register

| Excel cell | Role group | Exact workbook label | Priority | Domain | Existing page candidate (not acceptance) | UAT status |
|---|---|---|---|---|---|---|
| D2 | Factory Manager | Factory Overview | P2 | ADMIN_SERVICE_AND_REPORT | NO ROUTE CANDIDATE | UNVERIFIED |
| A3 | Company Admin | Business Overview | P2 | ADMIN_SERVICE_AND_REPORT | Company Dashboard | UNVERIFIED |
| D3 | Factory Manager | Today's Production | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| A4 | Company Admin | Today's Sales | P2 | ADMIN_SERVICE_AND_REPORT | NO ROUTE CANDIDATE | UNVERIFIED |
| D4 | Factory Manager | Order Progress | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| A5 | Company Admin | Today's Production | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| D5 | Factory Manager | Pending Approvals | P0 | ACCESS_AND_APPROVAL | Management Approval Inbox | UNVERIFIED |
| A6 | Company Admin | Pending Actions | P2 | ADMIN_SERVICE_AND_REPORT | NO ROUTE CANDIDATE | UNVERIFIED |
| D6 | Factory Manager | Production Delays & Alerts | P1 | ALERTS_AND_SLA | Production Dashboard | UNVERIFIED |
| A9 | Company Admin | Sales Details | P2 | ADMIN_SERVICE_AND_REPORT | NO ROUTE CANDIDATE | UNVERIFIED |
| D9 | Factory Manager | All Orders | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| A10 | Company Admin | Sales Margin | P0 | FINANCE_AND_PURCHASE | Integrated ERP | UNVERIFIED |
| D10 | Factory Manager | Running Orders | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| A11 | Company Admin | Sales Returns | P2 | ADMIN_SERVICE_AND_REPORT | NO ROUTE CANDIDATE | UNVERIFIED |
| D11 | Factory Manager | Pending Orders | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| D12 | Factory Manager | Completed Orders | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| D13 | Factory Manager | Order-Wise Production Status | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| A14 | Company Admin | Stock Overview | P0 | INVENTORY_AND_STOCK | Company Dashboard | UNVERIFIED |
| D14 | Factory Manager | Delivery Due Dates | P1 | ALERTS_AND_SLA | NO ROUTE CANDIDATE | UNVERIFIED |
| A15 | Company Admin | Low Stock Alerts | P0 | INVENTORY_AND_STOCK | NO ROUTE CANDIDATE | UNVERIFIED |
| A16 | Company Admin | Stock History | P0 | INVENTORY_AND_STOCK | NO ROUTE CANDIDATE | UNVERIFIED |
| D17 | Factory Manager | Fabric Purchase Status | P0 | FINANCE_AND_PURCHASE | Fabric Dashboard | UNVERIFIED |
| D18 | Factory Manager | Trims Purchase Status | P0 | FINANCE_AND_PURCHASE | Accessories Dashboard | UNVERIFIED |
| A19 | Company Admin | Shop Stock | P0 | INVENTORY_AND_STOCK | Shop Management | UNVERIFIED |
| D19 | Factory Manager | Pending Purchase Orders | P0 | FINANCE_AND_PURCHASE | Company Purchase Orders | UNVERIFIED |
| A20 | Company Admin | Shop Sales | P0 | INVENTORY_AND_STOCK | Shop Management | UNVERIFIED |
| D20 | Factory Manager | Material Availability | P0 | INVENTORY_AND_STOCK | NO ROUTE CANDIDATE | UNVERIFIED |
| A21 | Company Admin | Shop Transfers | P0 | INVENTORY_AND_STOCK | Shop Management | UNVERIFIED |
| D21 | Factory Manager | Purchase Delays | P0 | FINANCE_AND_PURCHASE | NO ROUTE CANDIDATE | UNVERIFIED |
| A24 | Company Admin | Warehouse Stock | P0 | INVENTORY_AND_STOCK | Warehouse Management | UNVERIFIED |
| D24 | Factory Manager | Production Plan – View | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| A25 | Company Admin | Material Inward | P0 | INVENTORY_AND_STOCK | NO ROUTE CANDIDATE | UNVERIFIED |
| D25 | Factory Manager | Target vs Actual | P2 | ADMIN_SERVICE_AND_REPORT | NO ROUTE CANDIDATE | UNVERIFIED |
| A26 | Company Admin | Material Issue | P0 | INVENTORY_AND_STOCK | Integrated ERP | UNVERIFIED |
| D26 | Factory Manager | Department-Wise Progress | P1 | PRODUCTION_AND_TRACE | NO ROUTE CANDIDATE | UNVERIFIED |
| A27 | Company Admin | Stock Transfer | P0 | INVENTORY_AND_STOCK | NO ROUTE CANDIDATE | UNVERIFIED |
| D27 | Factory Manager | Work in Progress (WIP) | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| D28 | Factory Manager | Production Delays | P1 | ALERTS_AND_SLA | Production Dashboard | UNVERIFIED |
| D29 | Factory Manager | Production History | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| A30 | Company Admin | Production Plan | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| A31 | Company Admin | Production Status | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| A32 | Company Admin | Production Reports | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| D32 | Factory Manager | Fabric Department | P0 | INVENTORY_AND_STOCK | Fabric Dashboard | UNVERIFIED |
| D33 | Factory Manager | Accessories Before Sewing | P2 | ADMIN_SERVICE_AND_REPORT | Accessories Dashboard | UNVERIFIED |
| D34 | Factory Manager | Cutting Department | P1 | PRODUCTION_AND_TRACE | Cutting Dashboard | UNVERIFIED |
| A35 | Company Admin | Purchase Orders – Add | P0 | FINANCE_AND_PURCHASE | Company Purchase Orders | UNVERIFIED |
| D35 | Factory Manager | Elastic Cutting | P1 | PRODUCTION_AND_TRACE | Cutting Dashboard | UNVERIFIED |
| A36 | Company Admin | Purchase Orders – Update | P0 | FINANCE_AND_PURCHASE | Company Purchase Orders | UNVERIFIED |
| D36 | Factory Manager | Delivery to Stitching / Vendor | P1 | PRODUCTION_AND_TRACE | Stitching Orders Workspace | UNVERIFIED |
| A37 | Company Admin | Pending – Production | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| D37 | Factory Manager | Stitching Department | P1 | PRODUCTION_AND_TRACE | Stitching Orders Workspace | UNVERIFIED |
| A38 | Company Admin | Pending – Warehouse | P0 | INVENTORY_AND_STOCK | Warehouse Management | UNVERIFIED |
| D38 | Factory Manager | Inward from Stitching / Vendor | P1 | PRODUCTION_AND_TRACE | Stitching Orders Workspace | UNVERIFIED |
| A39 | Company Admin | Pending – Shop | P0 | INVENTORY_AND_STOCK | NO ROUTE CANDIDATE | UNVERIFIED |
| D39 | Factory Manager | Accessories After Sewing | P2 | ADMIN_SERVICE_AND_REPORT | Accessories Dashboard | UNVERIFIED |
| A40 | Company Admin | Order History | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| D40 | Factory Manager | Checking | P1 | PRODUCTION_AND_TRACE | Checking Plans Workspace | UNVERIFIED |
| D41 | Factory Manager | Ironing | P1 | PRODUCTION_AND_TRACE | Ironing Queue Workspace | UNVERIFIED |
| D42 | Factory Manager | Packing | P1 | PRODUCTION_AND_TRACE | Packing Plan Overview Workspace | UNVERIFIED |
| A43 | Company Admin | Wages | P0 | FINANCE_AND_PURCHASE | Integrated ERP | UNVERIFIED |
| D43 | Factory Manager | Dispatch | P1 | PRODUCTION_AND_TRACE | Dispatch Ready Workspace | UNVERIFIED |
| A44 | Company Admin | Material Purchases | P0 | FINANCE_AND_PURCHASE | NO ROUTE CANDIDATE | UNVERIFIED |
| A45 | Company Admin | Other Expenses | P0 | FINANCE_AND_PURCHASE | Integrated ERP | UNVERIFIED |
| A46 | Company Admin | Expense Details | P0 | FINANCE_AND_PURCHASE | Integrated ERP | UNVERIFIED |
| D46 | Factory Manager | Fabric Availability | P0 | INVENTORY_AND_STOCK | Fabric Dashboard | UNVERIFIED |
| D47 | Factory Manager | Trims Availability | P0 | INVENTORY_AND_STOCK | Accessories Dashboard | UNVERIFIED |
| D48 | Factory Manager | Material Shortage Alerts | P0 | INVENTORY_AND_STOCK | NO ROUTE CANDIDATE | UNVERIFIED |
| A49 | Company Admin | Create User | P0 | ACCESS_AND_APPROVAL | User Management | UNVERIFIED |
| D49 | Factory Manager | Material Consumption Summary | P0 | INVENTORY_AND_STOCK | NO ROUTE CANDIDATE | UNVERIFIED |
| A50 | Company Admin | Create & Assign Role | P0 | ACCESS_AND_APPROVAL | User Management | UNVERIFIED |
| D50 | Factory Manager | Pending Material Issues | P0 | INVENTORY_AND_STOCK | Integrated ERP | UNVERIFIED |
| A51 | Company Admin | Edit / Deactivate User | P0 | ACCESS_AND_APPROVAL | User Management | UNVERIFIED |
| A52 | Company Admin | Permissions | P0 | ACCESS_AND_APPROVAL | User Management | UNVERIFIED |
| D53 | Factory Manager | Cutting Quality | P1 | PRODUCTION_AND_TRACE | Cutting Dashboard | UNVERIFIED |
| D54 | Factory Manager | Stitching Quality | P1 | PRODUCTION_AND_TRACE | Stitching Orders Workspace | UNVERIFIED |
| D55 | Factory Manager | Finishing Quality | P1 | PRODUCTION_AND_TRACE | NO ROUTE CANDIDATE | UNVERIFIED |
| D56 | Factory Manager | Rejection & Rework Summary | P1 | PRODUCTION_AND_TRACE | NO ROUTE CANDIDATE | UNVERIFIED |
| D57 | Factory Manager | Quality Pending Issues | P1 | PRODUCTION_AND_TRACE | NO ROUTE CANDIDATE | UNVERIFIED |
| D60 | Factory Manager | Ready for Dispatch | P1 | PRODUCTION_AND_TRACE | Dispatch Ready Workspace | UNVERIFIED |
| D61 | Factory Manager | Pending Dispatch | P1 | PRODUCTION_AND_TRACE | Dispatch Ready Workspace | UNVERIFIED |
| D62 | Factory Manager | Dispatched Orders | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| D63 | Factory Manager | Delivery Schedule | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| D64 | Factory Manager | Dispatch Delays | P1 | ALERTS_AND_SLA | Dispatch Ready Workspace | UNVERIFIED |
| D67 | Factory Manager | Purchase Approvals | P0 | ACCESS_AND_APPROVAL | Management Approval Inbox | UNVERIFIED |
| D68 | Factory Manager | Production Plan Change Approvals | P0 | ACCESS_AND_APPROVAL | Management Approval Inbox | UNVERIFIED |
| D69 | Factory Manager | Material Variance Approvals | P0 | ACCESS_AND_APPROVAL | Management Approval Inbox | UNVERIFIED |
| D70 | Factory Manager | Rework / Rejection Approvals | P0 | ACCESS_AND_APPROVAL | Management Approval Inbox | UNVERIFIED |
| D71 | Factory Manager | Dispatch Exception Approvals | P0 | ACCESS_AND_APPROVAL | Management Approval Inbox | UNVERIFIED |
| D72 | Factory Manager | Approval History | P0 | ACCESS_AND_APPROVAL | Management Approval Inbox | UNVERIFIED |
| A73 | Company Admin | Production Approvals | P0 | ACCESS_AND_APPROVAL | Management Approval Inbox | UNVERIFIED |
| A74 | Company Admin | Warehouse Approvals | P0 | ACCESS_AND_APPROVAL | Management Approval Inbox | UNVERIFIED |
| A75 | Company Admin | Shop Approvals | P0 | ACCESS_AND_APPROVAL | Management Approval Inbox | UNVERIFIED |
| D75 | Factory Manager | Daily Production Report | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| A76 | Company Admin | Approval History | P0 | ACCESS_AND_APPROVAL | Management Approval Inbox | UNVERIFIED |
| D76 | Factory Manager | Order-Wise Report | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| D77 | Factory Manager | Department Performance | P1 | PRODUCTION_AND_TRACE | NO ROUTE CANDIDATE | UNVERIFIED |
| D78 | Factory Manager | Material Usage Summary | P0 | INVENTORY_AND_STOCK | NO ROUTE CANDIDATE | UNVERIFIED |
| A79 | Company Admin | Customer Details | P2 | ADMIN_SERVICE_AND_REPORT | NO ROUTE CANDIDATE | UNVERIFIED |
| D79 | Factory Manager | Production Efficiency | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| A80 | Company Admin | Leads & Follow-Ups | P1 | ALERTS_AND_SLA | NO ROUTE CANDIDATE | UNVERIFIED |
| D80 | Factory Manager | Rejection / Rework Report | P1 | PRODUCTION_AND_TRACE | NO ROUTE CANDIDATE | UNVERIFIED |
| A81 | Company Admin | Marketing Expenses | P0 | FINANCE_AND_PURCHASE | Integrated ERP | UNVERIFIED |
| D81 | Factory Manager | Dispatch Report | P1 | PRODUCTION_AND_TRACE | Dispatch Ready Workspace | UNVERIFIED |
| A84 | Company Admin | Sales & Margin Report | P0 | FINANCE_AND_PURCHASE | NO ROUTE CANDIDATE | UNVERIFIED |
| D84 | Factory Manager | Create Department (Permission Controlled) | P0 | ACCESS_AND_APPROVAL | NO ROUTE CANDIDATE | UNVERIFIED |
| A85 | Company Admin | Stock Report | P0 | INVENTORY_AND_STOCK | NO ROUTE CANDIDATE | UNVERIFIED |
| D85 | Factory Manager | Department Heads | P1 | PRODUCTION_AND_TRACE | User Management | UNVERIFIED |
| A86 | Company Admin | Production Report | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| D86 | Factory Manager | Task Follow-Up | P1 | ALERTS_AND_SLA | Department Tasks | UNVERIFIED |
| A87 | Company Admin | Order Report | P1 | PRODUCTION_AND_TRACE | Production Dashboard | UNVERIFIED |
| D87 | Factory Manager | Delay Escalations | P1 | ALERTS_AND_SLA | NO ROUTE CANDIDATE | UNVERIFIED |
| A88 | Company Admin | Expense Report | P0 | FINANCE_AND_PURCHASE | Integrated ERP | UNVERIFIED |
| D88 | Factory Manager | Staff Performance Overview | P2 | ADMIN_SERVICE_AND_REPORT | NO ROUTE CANDIDATE | UNVERIFIED |
| A91 | Company Admin | Current Plan | P2 | ADMIN_SERVICE_AND_REPORT | Subscription Purchase | UNVERIFIED |
| D91 | Factory Manager | Low Material Alerts | P0 | INVENTORY_AND_STOCK | NO ROUTE CANDIDATE | UNVERIFIED |
| A92 | Company Admin | Purchase / Upgrade Plan | P0 | FINANCE_AND_PURCHASE | Subscription Purchase | UNVERIFIED |
| D92 | Factory Manager | Production Delay Alerts | P1 | ALERTS_AND_SLA | Production Dashboard | UNVERIFIED |
| A93 | Company Admin | Billing Management | P0 | FINANCE_AND_PURCHASE | Subscription Purchase | UNVERIFIED |
| D93 | Factory Manager | Approval Notifications | P0 | ACCESS_AND_APPROVAL | Management Approval Inbox | UNVERIFIED |
| A94 | Company Admin | Invoice History | P0 | FINANCE_AND_PURCHASE | Subscription Purchase | UNVERIFIED |
| D94 | Factory Manager | Delivery Due Alerts | P1 | ALERTS_AND_SLA | NO ROUTE CANDIDATE | UNVERIFIED |
| A97 | Company Admin | AMC Details | P2 | ADMIN_SERVICE_AND_REPORT | NO ROUTE CANDIDATE | UNVERIFIED |
| D97 | Factory Manager | My Profile | P2 | ADMIN_SERVICE_AND_REPORT | NO ROUTE CANDIDATE | UNVERIFIED |
| A98 | Company Admin | Book Appointment | P2 | ADMIN_SERVICE_AND_REPORT | NO ROUTE CANDIDATE | UNVERIFIED |
| D98 | Factory Manager | Notification Preferences | P1 | ALERTS_AND_SLA | NO ROUTE CANDIDATE | UNVERIFIED |
| A99 | Company Admin | Help & Support | P2 | ADMIN_SERVICE_AND_REPORT | NO ROUTE CANDIDATE | UNVERIFIED |
| D99 | Factory Manager | Help & Support | P2 | ADMIN_SERVICE_AND_REPORT | NO ROUTE CANDIDATE | UNVERIFIED |
| A100 | Company Admin | Raise Ticket | P2 | ADMIN_SERVICE_AND_REPORT | NO ROUTE CANDIDATE | UNVERIFIED |
| A103 | Company Admin | Company Profile | P2 | ADMIN_SERVICE_AND_REPORT | NO ROUTE CANDIDATE | UNVERIFIED |
| A104 | Company Admin | Shop / Warehouse Setup | P0 | INVENTORY_AND_STOCK | NO ROUTE CANDIDATE | UNVERIFIED |
| A105 | Company Admin | Notifications | P1 | ALERTS_AND_SLA | NO ROUTE CANDIDATE | UNVERIFIED |
| A106 | Company Admin | Security | P0 | ACCESS_AND_APPROVAL | NO ROUTE CANDIDATE | UNVERIFIED |

## Netlify preview diagnostic
Previous Netlify preview failed. Repository `client/vite.config.js` deliberately calls `assertSafeNetlifyPreview`; Netlify deploy-preview **requires an explicit isolated `VITE_API_URL`** and rejects a production `api.ugsaas.com` URL. This is a **possible root cause, not confirmed without Netlify deploy logs or build environment**. Do not disable this protection to force a green preview. Create a separate isolated staging Render backend and test Atlas database first, set preview-context variable privately in Netlify UI, then examine the failed deploy log and retest. Refer to `docs/staging-bootstrap.md`. GitHub CI success does not establish staging readiness.
