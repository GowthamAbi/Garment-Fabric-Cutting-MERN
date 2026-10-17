# UG SaaS HR department — development batch (17 October 2026)

**Workbook:** 21 HR options: Head F408–F417 (10), Staff F420–F430 (11).  
**Branch:** feature/department-role-sidebar-foundation-20261015 (PR #1, draft). Do not merge into main or change live tenant data.

## Implemented — development scope
- Adds HR to the department licence catalogue and permissions while preserving original 9 garment workflow stages. HR is NOT a garment stock ledger/boundary.
- Existing tenant-scoped **ErpEmployee**, **ErpAttendance**, and posted immutable **ErpPayslip** from /erp/workforce are authoritative. Does not duplicate employees into another source of truth.
- New /api/erp/departments/hr/overview reads people, attendance, HR activity registers; salary/payslip fields are unavailable unless **hr.payroll.read** or permitted company administration roles. Other HR users only see non-payroll data.
- Writes: scoped unique employee master, immutable audit for single-row/batched attendance (max 100 CSV rows; existing entries cannot be overwritten), onboarding record, shift record, leave request, overtime hours record, nonfinancial payroll-input preparation (paid days/OT hours), document metadata, correction request, performance-review references, recruitment references. Relevant writes are checked for HR department permission/subscription.
- Attendance writes directly to the existing payroll workforce attendance table; correction requests are nonposting and DO NOT overwrite or adjust recorded attendance.
- Recorded overtime hours do not calculate wages. Leave/correction requests remain PENDING with NO manager action yet. Performance and compliance are reference registers, NOT independently verified appraisal or statutory compliance.
- Payslip history is only queryable to payroll-authorized roles; view is a redacted summary without confidential personal details. Payroll rules, accrual approval, PF/ESI/statutory declarations and salary payments remain under separate protected /erp/workforce flow.
- Employee document registry is **reference-only**, no file binaries/IDs, bank credentials, Aadhaar, health info; any external document storage needs separate privacy controls.
- 21 options routed, Head monitoring/read-only, Staff controlled forms, Excel/CSV-compatible exports and browser print.

## Excel Mapping
Head: F408 dashboard; F409 employee overview; F410 attendance monitoring; F411 leave/OT overview; F412 payroll review (extra payroll permission); F413 performance references; F414 recruitment/compliance references; F415 generic approvals; F416 tasks; F417 reports.
Staff: F420 dashboard; F421 employee master; F422 onboarding; F423 attendance entry/import; F424 shift/leave; F425 OT; F426 payroll input preparation; F427 employee document references; F428 leave/correction; F429 payslip/history (extra payroll permission); F430 HR reports.

## Important pending
1. **Leave/OT approval** is not integrated into HR Head's generic approval inbox and does not automatically affect paid days.
2. Payroll-input recommendations are not connected to immutable reviewed payslip preparation; payroll is separate and salary payment not automatic.
3. CSV parser covers simple comma-separated 3–4 fields, not quoted commas/complex encodings or drag-drop xlsx; user should verify previews before import.
4. Employee termination, shift rotation, approved overtime controls, security audit on HR sensitive reads, data retention/encryption/field-level controls and lawful consent must be verified before real HR data rollout.
5. Browser/mobile E2E, multi-company/factory access tests, Netlify preview repair, prints/report pagination.
6. Paid HR feature requires both selected licensed HR department and permitted ERP_HR feature; existing legacy contracts keep old workflow behavior.

**CI:** Check latest GitHub Action runs separately; route and policy unit test success does not equal production-ready acceptance.
