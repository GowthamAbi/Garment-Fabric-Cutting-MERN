# UG SaaS — Delivery Department development (17 October 2026)

**Branch:** `feature/department-role-sidebar-foundation-20261015` (draft PR #1); production `main` untouched.
**Source:** `Book1.xlsx` — 20 Delivery requirements: 10 Department Head (F120–F129), 10 Staff (F132–F141).
**Acceptance state:** development batch implemented; complete E2E acceptance **DEFERRED** as requested. Not production-ready.

## Implemented / improved in this batch

1. **Atomic Cutting-to-Delivery DC allocation:** `createChallan` executes in a MongoDB transaction, serializing writes on `FabricCutPlan.deliveryRevision` before re-reading issued DC quantities. Revalidates each colour+size against completed Cutting Actual and blocks invalid, negative, fractional, duplicate and over-issued PCS. Concurrent DC creations cannot both spend the same remaining Cutting PCS successfully.
2. **Cutting and Folding mandatory:** pure `deliveryStageStatus` enforces both; Elastic remains optional.
3. **Idempotent DC:** client submits stable Idempotency-Key for retries; server stores request key/hash, returns existing DC for identical retry and rejects key reuse for different payloads. Backend accepts missing keys for legacy callers but generates a fresh key (retries require explicit key).
4. **Separate physical handover:** `POST /delivery/challans/:id/handover` requires a vendor POD/signature reference; sets handover timestamp/actor exactly once, and permits identical retry. Issuing a DC and physically handing it to a vendor are now distinct stages.
5. **Expected handover date** is optional at DC creation; overdue monitor uses only saved dates and never assumes a promised deadline.
6. **Delivery monitoring API** `GET /delivery/monitoring` returns Cutting/Folding/optional Elastic stage, actual PCS, issued PCS, unallocated PCS, vendor-wise issued/handed over/pending and overdue PCS, awaiting handovers and known overdue DCs.
7. **Dedicated Head screens:** Cutting & Folding Completion, Vendor/Section Status, DC Monitoring, Delivered vs Pending, Delay Monitoring, Reports.
8. **Dedicated Staff handover and pending screen:** staff can record handover reference; Head has read-only UI.
9. **Legacy factory safety:** all /delivery endpoints fail closed if the current company is not the single active factory; old plan/vendor/challan records need migration for multi-factory use.
10. **Excel mapping:** all 20 Head/Staff options route to an existing screen or new delivery monitoring screen.
11. Added policy tests for PCS safety, completion rule, vendor pending/overdue accounting, handover reference; 20-option Head/Staff routing tests. Existing Fabric replica-set regression remains green.
12. Existing Vendor Registration (multiple stitching items, QC follow-up), Section Plan, DC generation and printable DC history retained.

## Workbook scope and gaps

| Excel | Role | Option | Current scope |
|---|---|---|---|
| F120 | Head | Dashboard | Shared department dashboard |
| F121 | Head | Delivery Plans | Existing real plan details |
| F122 | Head | Cutting & Folding Completion | New monitor |
| F123 | Head | Vendor / Section Status | Vendor-wise issued vs handover |
| F124 | Head | Delivery Challan Monitoring | New DC pending monitor |
| F125 | Head | Delivered vs Pending | New issued/handed-over/unallocated PCS summary |
| F126 | Head | Delivery Delays | Overdue DCs only when expected date recorded |
| F127 | Head | Pending Approvals | Existing approval inbox; DC-specific approvals not yet integrated |
| F128 | Head | Staff & Tasks | Existing shared tasks |
| F129 | Head | Reports | New monitor and CSV/print |
| F132 | Staff | Dashboard | Shared department dashboard |
| F133 | Staff | Vendor Registration | Existing vendor master / QC / stitching items |
| F134 | Staff | Completed Plans | Cutting/Folding status page |
| F135 | Staff | Delivery Plan Entry | Existing plan selection; persistent separate draft not implemented |
| F136 | Staff | Section / Vendor Allocation | Existing vendor/colour/size selection, directly creates DC |
| F137 | Staff | Delivery Challan Generate | Existing DC with new atomic issue protection |
| F138 | Staff | Delivery Handover | New once-only handover confirmation |
| F139 | Staff | Vendor Pending Qty | Pending *handover* PCS only; stitching returns pending still absent |
| F140 | Staff | DC History | Existing date/vendor/plan filtered history |
| F141 | Staff | DC Print & Reports | Existing DC print/Excel |

## Deferred development and final E2E tests

- **Persisted Delivery Plan draft** with version, vendor/section allocations, editing/approval, DC generation only from approved allocations; currently Section Plan directly creates DC.
- **Vendor stitching reconciliation:** vendor production-return/inward and remaining piece quantities (sent minus stitched returned, rework, rejection), vendor capacity/delay SLA. Pending handover is **not** equivalent to vendor stitching pending.
- **Cancellation and return:** controlled cancellation, reverse historical DC allocations and proof of handover/receipt, not direct deletion; reconcile with downstream stitching ERP.
- **Multi-factory migration** for historical FabricCutPlan / FabricCutActual, vendors, DCs, and sequence. Current legacy single-factory guard prevents cross-factory leakage.
- **Authenticated staging E2E**: real Fabric Cutting→Folding→Delivery issuance/handover→Stitching transfer, idempotent retried DC, concurrent 2-device race, print black-and-white, mobile, QC and vendor signature.
- **Scale:** fixed limit monitoring 5000 DCs, 1000 plans, 1500 actuals must move to cursor pagination/aggregations; totals on huge data sets may be incomplete beyond caps.

**Verified development checks:** GitHub Actions Approval Development Checks [39000777638](https://github.com/GowthamAbi/Garment-Fabric-Cutting-MERN/actions/runs/39000777638) — 241 backend passed / 8 skipped / 0 failed; 41 frontend passed / 0 failed; client build passed. Fabric Database Workflow QA [39000777639](https://github.com/GowthamAbi/Garment-Fabric-Cutting-MERN/actions/runs/39000777639) passed.

**Release gate:** **NOT 20/20 VERIFIED_COMPLETE.** Explicit user plan: complete all departmental development batches first, then integrated system E2E testing. Production site and customer data untouched.

## Delivery follow-up — vendor stitched-piece return & permission guard batch
- Added tenant-isolated, append-only `DeliveryVendorReceipt` ledger, vendor return reference, per DC/colour/size **good/rework/rejected PCS**, returned PCS and pending stitching PCS.
- Receipt acceptance is restricted to an **ISSUED + physically handed-over DC**, enforces non-negative whole PCS, never over-returns, supports stable idempotent retries and serializes writes on a DC in MongoDB transactions.
- Added `GET /delivery/vendor-return-monitoring`, paginated `GET /delivery/vendor-returns` and `POST /delivery/vendor-returns`; Staff entry + Head reporting available from **Vendor Pending Qty** view; CSV/print use monitoring table.
- Enforced explicit generic department isolation and prohibited Head operational writes on **all Delivery routes** (previous generic allowDepartment middleware could otherwise fall through to legacy role allowlist).
- Added pure policy unit tests for role separation, over-return/invalid returns and distinguishing stitching from handover pending.
- **NOT stock inward**: return acknowledgement never credits ERP, Sewing or Warehouse stock. Downstream INWARD integration/reconciliation, reversals, multi-factory migration, authenticated staging end-to-end tests, large-data pagination and physical print/mobile tests remain pending.
