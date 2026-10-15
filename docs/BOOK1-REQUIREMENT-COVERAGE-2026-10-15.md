# Book1.xlsx Requirement Coverage — 15 Oct 2026

**Source:** User-supplied `Book1.xlsx`, sheet `Company Admin`, Excel range A1:F459. A=Company Admin menu, D=Factory Manager menu, F=16-department Head and Inventory/Staff menu proposals. Counts below represent **itemized menu rows**, not a count of implemented APIs or functioning pages. A few unnumbered Company Admin group labels are additional organizing headings.

## Scope extracted
- **466 itemized requests:** Company Admin 58, Factory Manager 74, Department Head/Staff 334.
- **16 proposed departments**, 14 currently licensed/catalogued. HR and Accounts are *not* in the shared `DEPARTMENTS` catalogue.
- Five existing operational sidebars (Fabric, Cutting, Accessories, Elastic, Delivery) have dedicated screens/menus, but these are **not verified one-to-one** against the uploaded workbook.
- The other departments have some existing shared ERP functionality and a *generic planning sidebar*, not all 10–13 workbook-specific Head/Staff screens and their API workflows. `DepartmentRolePreview.jsx` expressly says it is "a design preview only."
- New request → Head → Factory Manager → Owner approval work is in the feature branch but real MongoDB integration and end-to-end UI tests remain gating.

| Department | Head + Staff items | Evidence category |
|---|---:|---|
| Fabric | 21 | Existing module, Excel parity unverified |
| Cutting | 23 | Existing module, Excel parity unverified |
| Accessories | 20 | Existing module, Excel parity unverified |
| Elastic | 20 | Existing module, Excel parity unverified |
| Delivery | 20 | Existing module, Excel parity unverified |
| Stitching | 21 | Shared framework, per-option unverified |
| Inward | 21 | Shared framework, per-option unverified |
| Checking | 21 | Shared framework, per-option unverified |
| Ironing | 20 | Shared framework, per-option unverified |
| Packing | 21 | Shared framework, per-option unverified |
| Despatch | 21 | Shared framework, per-option unverified |
| Warehouse | 22 | Shared framework, per-option unverified |
| Shop | 21 | Shared framework, per-option unverified |
| Marketing | 20 | Shared framework, per-option unverified |
| HR | 21 | Not licensed as own department |
| Accounts | 21 | Not licensed as own department |

## Evidence and release blockers

1. `client/src/config/departmentRoleSidebars.js`: 16 proposed departments, HR/Accounts explicitly `NOT_YET_LICENSED`; menu generation uses `commonHead`, `commonStaff` and 3 generic per-department labels.
2. `client/src/pages/dashboard/DepartmentRolePreview.jsx`: design preview and not a working data-entry screen. Do not treat a menu label as proof a save/approval/print feature works.
3. `shared/departmentCatalogue.js`: only 14 licensed department codes.
4. `FINAL-ERP-SCOPE.md`: documents legacy forms not fully rewritten, missing automatic scheduling/FIFO/enterprise finance features, and database/security/mobile tests outstanding.
5. New feature code is pushed to a **draft PR**: https://github.com/GowthamAbi/Garment-Fabric-Cutting-MERN/pull/1 . It is not merged into `main`.
6. Real staging approval/inventory validation is blocked until staging database authentication works; unit tests and client builds do not prove production readiness.
7. Some checklist functionality may already exist in main's integrated ERP; **no exact item-level completion claims** are made without staging role-by-role QA.

## Required before live merge

- Map every requirement to a real route, page, API permission and database collection, or explicitly mark the feature not implemented.
- Test the first five departments' existing forms (inward, folding, production plan, roll QR, batch/set, cutting machine/Gantt, delivery DC) without regressing them.
- Complete and test each additional department's Head and Staff screens plus Company Admin and Factory Manager pages.
- Add HR/Accounts licensing and department-specific permissions only when both interfaces and backend are ready.
- Run transaction-capable MongoDB integration tests and staging multi-factory/multi-tenant checks.
- Test mobile layouts, alignment, black/white print, exports, reporting and audit/approval workflows.
- Protect existing live customer inventory and take backups; merge only after review and explicit go-live sign-off.

**Decision: NOT COMPLETE. DO NOT MERGE THE DRAFT PR INTO MAIN OR DEPLOY ITS UNVERIFIED FEATURES TO LIVE.**
