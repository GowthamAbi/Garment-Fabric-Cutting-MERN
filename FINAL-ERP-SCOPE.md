# Consolidated ERP scope — 7 October 2026

| Requested area | Implemented in this package | Boundary / remaining work |
|---|---|---|
| Department integration | New Work Order routes, mandatory Cutting/Folding, final Packing, partial-stage capacity and receipt gate | Existing legacy entry forms are not rewritten; use new screens after reviewed cutover. Stage records attest operator completion, not measured machine output. |
| Roll/batch/QR | Distinct physical-roll SKU, receipt registration, live ERP balance, batch/set grouping, protected QR trace | No interchangeable-roll BOM selection or automatic FIFO; at most 100 components per BOM/document. Legacy roll records require reviewed mapping. |
| Production/MRP | Frozen BOM Work Orders and aggregate material-shortage suggestions | Suggestions are not reservations. Open PO commitments, alternatives, scrap allowances and finite-capacity optimization need future extension. |
| Machine scheduling | Stage/machine master, overlap and active-job checks, partial assignment, run/pause events, Gantt and weekly CSV/print | Downstream assignment requires actual previous-stage completion. Reports are capped at 2,000 dashboard jobs/events; no automatic schedule optimizer. Completed operations are immutable; cancellation applies only to planned jobs. |
| Vendor/jobwork/delivery | Supplier/QC-contact/item fields, existing jobwork send/partial return, pending report, QC and printable Dispatch documents | Jobwork movement is same SKU; transformation uses BOM. No separate legacy vendor-specific challan-form conversion. Vendor charges must be posted explicitly as reviewed costs. |
| Approval controls | Configurable selected document types/threshold, independent administrator review, frozen input, transactional final posting | Two customer admins required for independent approval. It does not govern every HR/profile setting; reversals have separate grants and dependency checks. |
| Cost/profit | Actual materials/work costs, allocated output/remaining WIP, average output cost, sales-order sales/COGS margin indicator | No standard-cost estimate snapshot or automatic overhead allocation. Margin is not overall net profit and may overstate results before dispatch. |
| Finance | Due-date snapshot, credit limits, linked invoice ageing, GL reports, bank CSV import and reviewed match/unmatch | Single BANK ledger/factory. No automatic bank feeds, multicurrency, statutory GST filing/e-invoice API or configurable account chart. |
| Maintenance/HR | Due blocking maintenance tasks, employee/attendance records, manually reviewed payslips, void/correction history | No auto preventive recurrence, leave accrual, salary payout, statutory deductions or payroll-to-GL automation. |
| Subscription SaaS | Settlement entitlement snapshot, concurrent user/department limits, explicit ERP feature licensing, existing billing/invoice/reminder/refund/backup tooling | Legacy department-only plans deliberately retain access. Real payment/email/database tests, hosted browser journeys, backup restore, monitoring/load/security assessment remain required. |

## Data and operational limits

- Separate customer databases and explicit factory scopes are application controls. Infrastructure/database administrators with credentials can still read/delete data; operator permission policy and database least privilege are required.
- Posting, scheduling and bank matching serialize through a per-factory settings row to prevent races. This prioritizes correctness over high posting throughput; load testing and higher-scale design remain necessary.
- No live customer data was migrated or modified while building this package. Activation is an explicit reviewed cutover, not a silent migration.
- Real database integration suites are included but skipped without staging credentials. Unit/planner tests and a frontend build do not establish production readiness.
- GST provider onboarding, automatic statutory payroll and enterprise planning are not implemented. This ZIP is the consolidated implemented release, not a claim that every ERP capability is complete.
