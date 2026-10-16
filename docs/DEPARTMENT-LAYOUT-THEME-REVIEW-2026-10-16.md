# UG SaaS — Department Layout & Theme Code Review
**Review date:** 16 October 2026  
**Release status:** Development branch only. No merge to `main` or production deployment.

## What was actually verified
- Reviewed `client/src/components/layout/MainLayout.jsx`, `client/src/routes/AppRoutes.jsx`, `client/src/pages/erp/Departments.jsx`, theme layers, and existing print CSS.
- The shared ERP workspace contains all **14 catalogue departments**. Each uses the `erp-shell`, `erp-card`, `erp-grid`, `erp-table` and tab/navigation patterns, so shared styling changes apply to all 14.
- Dedicated operational sidebar families exist for **Fabric, Cutting, Accessories, Elastic, Delivery**. Other departments use the shared ERP workspace rather than complete Excel-specific Head/Staff screens.
- `client/src/styles/professional-workspace.css` is loaded **after** the existing company, owner and theme styles. It introduces consistent card borders, horizontal table scrolling, input/grid width constraints, keyboard focus, dark-theme surfaces, narrow-mobile treatment, and role-specific sidebar spacing/icons.
- Changes are scoped to `@media screen`; existing print logic in `styles.css` and `pages/erp/erp.css` was not modified. **This is not a guarantee that every print document prints correctly.**

## Department code coverage and review requirements
The statuses below indicate **source-based UI review**, not completed end-to-end browser tests.

| Department | Current UI entry point | Code/layout check | Manual QA still needed |
|---|---|---|---|
| Fabric | Dedicated Fabric screens + ERP | Shared responsive CSS applies | Inward/roll, print, folding, QR, batch/set, dark/light |
| Cutting | Dedicated Cutting/Machine screens + ERP | Shared responsive CSS applies | Plan, timeline/Gantt, machine status, report width, mobile |
| Accessories | Dedicated stock/PO screens + ERP | Shared responsive CSS applies | Inward, PO, balance stock, tables, save/print |
| Elastic | Dedicated production/warehouse screens + ERP | Shared responsive CSS applies | Planning, DC, warehouse, rework, mobile |
| Delivery | Dedicated vendor/section screens + ERP | Shared responsive CSS applies | Vendor, section DC, tracking, PDF/print |
| Stitching | Shared ERP department workspace | Shared responsive CSS applies | Role form, operation/line detail, record save, report |
| Inward | Shared ERP department workspace | Shared responsive CSS applies | Stitching DC receipt, partial/excess, history |
| Checking | Shared ERP department workspace | Shared responsive CSS applies | Pass/rework/oil/reject, stock effect |
| Ironing | Shared ERP department workspace | Shared responsive CSS applies | In/out status, queue, print |
| Packing | Shared ERP department workspace | Shared responsive CSS applies | Material/carton entry, balance/print |
| Dispatch | Shared ERP department workspace | Shared responsive CSS applies | Order ready, DC, transporter, movement |
| Warehouse | Shared ERP department workspace | Shared responsive CSS applies | Location stock, transfer, mobile table |
| Shop | Shared ERP department workspace | Shared responsive CSS applies | Sale, return, stock/finance visibility |
| Marketing | Shared ERP department workspace | Shared responsive CSS applies | Demand, forecast, reporting and mobile |
| HR | Not in licensed 14-department catalogue | **Not complete** | HR-specific screens, roles, APIs; workforce feature is separate |
| Accounts | Not in licensed 14-department catalogue | **Not complete** | Accounts-specific screens, roles, APIs; ERP finance feature is separate |

## Role-based layout
- Department Head/Staff users with single-department scope now get one dedicated sidebar with consistent icons and selected-page indication.
- Navigation is based on `roleDepartmentPages()`; APIs must independently enforce authorization. The feature branch also includes server-side Head review-only and Staff write permission tests.
- Company Owner / Company Admin / Factory Manager still require role-by-role signed-in screenshots to verify that the menus match each Excel requirement. A menu existing is not evidence that its associated workflow is complete.

## Visual QA matrix — remaining acceptance checks
| Scenario | Status |
|---|---|
| Code build and unit tests in GitHub Actions | Automated |
| Desktop 1440×900, 1280×800; Chrome | Manual browser review pending |
| Tablet 1024×768 and 768×1024 | Manual browser review pending |
| Mobile 390×844 and 320×640, real login | Manual browser review pending |
| Light / dark switch for all department screens | Manual browser review pending |
| Long labels, no horizontal page clipping, scrollable wide tables | Manual browser review pending |
| Print preview: Fabric, Cutting, QR, Folding, Delivery DC | Manual browser review pending |
| Data-save, stock movement, tenant separation, approval transaction | Staging database integration pending |

## Blocker
The last real staging API deployment exited with **MongoDB `bad auth : authentication failed`**, despite having the correct Atlas outbound IP allowlist. The user must update the **staging-only** MongoDB database-user password and Render staging `MONGODB_URI` privately. Do not disclose credentials in GitHub, logs, screenshots, or chat. Without this, real browser login, role-by-role acceptance, live-save and customer isolation tests cannot be certified.

## Go-live policy
All code remains in [draft development PR #1](https://github.com/GowthamAbi/Garment-Fabric-Cutting-MERN/pull/1). **Do not merge to `main`** without (a) successful staging database authentication, (b) verified role-based QA, (c) real print/mobile acceptance, and (d) explicit user release approval. The original 466-item Excel is a requirements register, not 466 completed screens.
