# Company Admin / Role-specific Portal Navigation — 17 October 2026

## Reproduction
Customer Company Admin login displayed a **Department workspaces** list with all enabled departments, followed by FABRIC/CUTTING/DELIVERY/ELASTIC/ACCESSORIES and ADMIN portal sections, even though the user logged into the Company Admin portal. `MainLayout.jsx` permitted `company_admin` to render every department group. Company Dashboard also offered an `Open <department> workspace` button.

## Fix
- Added reusable pure `portalNavigationPolicy.mjs` for assigning exactly one sidebar section per role, plus an app-level page guard.
- Company Admin / Company Owner: only **COMPANY_ADMIN** section, with Company Dashboard first and Company Reports, Factory Management, Company Stock, Company Approvals, User Management, Item Master, Audit & Backup, Company Purchase Orders, subscription and other company-level controls.
- Factory Admin (`admin`): only **ADMIN** section. Department users: their assigned department. SaaS Owner keeps the independent `SuperAdminLayout`.
- No `Department workspaces` list for company/factory administrators. For a modern department-only login on unsupported legacy department group, show only that assigned department's workspace.
- Hid generic extra navigation for dedicated portals so Fabric/Production/ERP links are not mixed into Company Admin pages.
- Removed Company Dashboard's direct department-workspace launch button. Department production statistics remain visible as company-level management reporting.
- App and AppRoutes both prevent another portal's page from rendering when stale state or direct navigation tries to select it.
- Does not change ERP business functionality, API authorization, tenant database, accounts/stock, production grants or subscriptions.

## Security & acceptance
This prevents **UI mixing**. Actual access to backend data is independently guarded by server roles, subscriptions and tenant context. Do not treat menu hiding as backend authorization.

Automated navigation/role tests and frontend Vite build required. Then Company Admin, Factory Admin, Fabric, Delivery, Owner role logins must be checked on a mobile/browser. Only merge/deploy this focused PR after owner review; do not release unfinished 16-department PR #1.
