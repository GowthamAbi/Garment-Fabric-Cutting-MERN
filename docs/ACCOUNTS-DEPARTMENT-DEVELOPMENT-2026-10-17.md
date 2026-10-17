# UG SaaS — ACCOUNTS Department development — 17 October 2026

**Book1.xlsx** Accounts 21 option references: Head F437–F446 (10), Staff F449–F459 (11).  
**Feature branch:** `feature/department-role-sidebar-foundation-20261015` (draft PR #1). No merge into main, no live tenant data changed.

## Implemented in this batch
- Adds Accounts as the **sixteenth** selectable department and permission set; does not add a garment workflow or stock movement stage. The older 9-stage garment workflow licensing contract stays unchanged.
- Dedicated Accounts read-only **GET /api/erp/departments/accounts/overview?days=30**: tenant/factory scoped canonical `ErpEntry` journals, `ErpDocument` invoices, `ErpParty`, `ErpBalance` and imported bank rows. Ledger and trial balance use existing `financialReport`, invoice ageing uses existing `commercialReport`. Real posted sales-order COGS yields **indicative** margin. Capacity limits fail closed, not silently truncated totals.
- Separate **Accounts department subscription** + **ERP_FINANCE module** + **ERP Finance read grant** required, even for a user with `department.accounts.read`; write additionally requires `department.accounts.write` and the exact ERP `erp.accounts` or `erp.purchase` posting grant. Sensitive account values never leak into nonfinancial department views through these endpoints.
- Dedicated `POST /accounts/post` delegates *only* `PURCHASE_INVOICE`, `JOURNAL`, `RECEIPT`, `PAYMENT` to the **same transactional, idempotent ERP `postDocument` service** with all existing approval, stock, settled-amount and journal-balance checks. No parallel accounts balance/document table.
- Staff customer/supplier GL ledger, Purchase Invoice linked to **posted Goods Receipt**, real Sales Invoice review, balanced Expense Voucher / Cash Bank Journal, invoice-linked supplier payments/customer receipts, bank reconciliation via existing ERP bank screen; tax ledger and transaction history. Head metrics, unpaid invoice due list, cash/bank GL values, cost and margin overview, reports, tasks and generic approval inbox.
- Payroll Accounting lists **posted payroll GL document references**, **NOT private individual payslips**. HR payroll rule/accrual/reversal remain in separately permissioned `/erp/workforce`.
- Print and Excel/CSV compatible export for 21 workbook navigation options. Customer due alerts are current on-screen lists, **not pushed notifications**.

## Excel mapping
Head: F437 Dashboard; F438 Financial Overview; F439 Receivables & Payables; F440 Purchase/Expense Monitoring; F441 Cash/Bank Position; F442 Cost/Margin; F443 Due Alerts; F444 generic Pending Approvals; F445 Teams & Tasks; F446 Financial Reports.

Staff: F449 Dashboard; F450 Customer/Supplier Ledger; F451 Purchase Invoice Entry; F452 Sales Invoice Review; F453 Expense/Voucher; F454 Payment/Receipt; F455 Cash/Bank Entry; F456 Bank Reconciliation; F457 Payroll Accounting; F458 Tax/Ledger Reports; F459 Transaction History.

## Known limitations / Production acceptance pending
1. Statutory GST filings, GST/HSN/SAC validations, TDS/TCS, e-invoicing/IRN and e-way bills; reports are **general ledger postings only**, not statutory returns.
2. Source invoice due date fallback is 30 days unless invoice metadata supplies dueDate. Review each customer's/supplier's terms before issuing notices. Notifications not automated.
3. Expense voucher is balanced journal direct debit OPERATING_EXPENSE/credit Cash or Bank; no vendor AP invoice linkage, approval queue UX, or statutory expense invoice book yet. Complex journals and approval-submission must use ERP approval workspace.
4. Purchase Invoice is linked to Goods Receipt via existing engine; verify actual warehouse receipt/GR/QC chain, tax assumptions, supplier invoice numbering in real integration test.
5. AR/AP account sign balances, cash/bank statement imports and GL may differ until bank reconciliation and opening balances are independently reviewed.
6. No automatic payroll accounting from attendance; payroll remains reviewed and independent HR process.
7. Authentication / permission / subscription / multi-factory E2E, simultaneous posting, bank matching, statement import, credit terms, date filters, GST print formatting, mobile and browser visual QA, Netlify staging preview repair.

**Build/CI:** verify latest commit GitHub Action status separately; passing unit tests is not production acceptance.
