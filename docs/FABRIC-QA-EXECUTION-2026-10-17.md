# Fabric Department QA execution — 17 October 2026

**Scope:** UG SaaS Fabric Department; Excel Fabric Head F4-F13 (10) and Fabric Staff F16-F26 (11).
**Code ref before recording QA:** `b8d08318ac98727f90003cc0b9a6d58c6a02f522`.
**Environment:** dedicated Render staging frontend/API and isolated Atlas `UGS-Staging`. Live `main`/production untouched.

## Verification actually executed

| Check | Observation | Result |
|---|---|---|
| GitHub Actions CI | Run [38952244992](https://github.com/GowthamAbi/Garment-Fabric-Cutting-MERN/actions/runs/38952244992) at b8d08318; server 227 total, 220 pass, 7 skipped, 0 fail | PASS (excluding skipped tests) |
| Frontend tests and build | 26 pass, 0 fail; client build successful | PASS |
| Fabric menu parity | All 21 Head/Staff Excel options map to declared screens; role split 10 Head/11 Staff | PASS for **navigation only** |
| Fabric unit/policy checks | Invalid issue weight/key rejected, prior allocations accounted for, colour/Dia remaining computed, Staff/Head authorization boundaries, subscription isolation, single-factory legacy guard, monitor filters | PASS for unit/policy tests |
| Render staging API | Backend deploy `dep-db97b1rodcbs739jgnag` at b8d08318 status LIVE; application logs include `MongoDB connected successfully` and `UG SaaS API running on port 10000` | PASS for deployment startup/connection |
| Render staging UI | Frontend deploy `dep-db97b2gn74is738mc5q0` at b8d08318 status LIVE | PASS for deployment status |
| Atlas direct connection | Connected to separate `UGS-Staging` Atlas cluster | PASS |
| Database CRUD smoke | In *disposable* database `ugs_staging_fabric_qa_smoke`, inserted one QA document, read back and checked department/weight/environment, then deleted document (one document deleted) | PASS — DB connectivity/CRUD only |
| Existing staging test company | Atlas database list prior to smoke contained only `admin` and `local`; no app control or tenant databases detected | BLOCKED — no authentic Fabric company/workflow fixture |
| Authenticated Fabric E2E | No staging Head/Staff accounts or Fabric dataset available for browser/API Create→Plan→Issue→Stock test | NOT RUN |
| Physical QR printer/black-and-white print and mobile GUI | No interactive browser/printer session | NOT RUN |
| MongoDB-backed transaction integration tests | 7 backend integration tests are skipped in CI; not silently counted as passes | NOT RUN |

**Do not claim Fabric fully completed or 21/21 verified:** 21/21 screen routing is distinct from 21/21 functional acceptance. Database smoke directly through the Atlas connector does **not** exercise backend transaction/authorization logic.

## Remaining functional/integration gates
1. Establish a disposable staging company/factory and Fabric Head & Staff role accounts, with FABRIC licensed. Do **not** reuse live customer accounts or data.
2. From Fabric Staff UI/API: save Fabric Master, Inward DC with colour/Dia/roll weight, batch/set and QR. Confirm saved/read back and correct printing.
3. Create Fabric Production Plan, edit before issue, verify Head overview. Test Cutting Actual→Folding prerequisite on genuine staging records.
4. Issue partial fabric KG; validate FIFO roll allocation, plan allocation and inward/roll stock all reconcile in a transaction, including duplicate idempotency retry, concurrent requests, insufficient stock and wrong Dia rollback.
5. Verify Head is strictly read-only, Staff limited to assigned company/factory, subscription and approvals enforced, no negative stock, mobile layouts and report exports.
6. Reconcile legacy Cutting `/api/fabric-cutting/plans/:no/issue` against new `/api/fabric-cutting/fabric-issues`: separate issue writers exist and need integrated verification.
7. Complete Purchase Order lifecycle as per business requirement, multi-factory legacy-data migration, and end-to-end report/print acceptance.

## Release decision
**NOT PRODUCTION READY.** Existing CI, Atlas CRUD smoke and staging startup passed. Transactional Fabric business workflows, purchase/integration gaps and real-role staging acceptance remain unresolved. No changes to production or existing customer data.


## 17 October follow-up: real replica-set Fabric workflow verification

A new **isolated MongoDB replica-set** GitHub Actions job now executes `server/tests/fabricMongoWorkflow.test.js` against a temporary Docker MongoDB 7 database, and deletes the database/container at the end.

- Source commit: `f05283a452b9e6559eeefd640c33dd19309d2f86`.
- [Fabric Database Workflow QA run 38995472644](https://github.com/GowthamAbi/Garment-Fabric-Cutting-MERN/actions/runs/38995472644): **PASS**, 1 test, 0 failures, 0 skipped.
- [Approval Development Checks run 38995472569](https://github.com/GowthamAbi/Garment-Fabric-Cutting-MERN/actions/runs/38995472569): **PASS**.
- The transaction test creates a temporary QA company, one factory, Fabric Head and Staff fixtures; persists Fabric Master, approved item, inward receipt (two rolls totalling 10 kg), plan (2 kg required), and a 1.25 kg issue. Inward, roll and issue register all reconcile to **8.75 kg remaining**.
- Validates generated batch/QR data, role separation (Head POST forbidden; cross-department denied), idempotent replay, conflicting replay, wrong Dia, over-issue rejection, and ledger non-duplication.
- This test injects role context via an in-test harness, **not full browser login/session authentication**, and tests a separate CI replica set rather than the deployed staging database.
- Isolated Atlas `UGS-Staging` connection also previously passed insert/read/delete smoke testing.
- An attempt to provision persistent QA login users on the live staging Atlas cluster could not be completed. The **two temporarily inserted QA fixture documents (registry and company) were immediately deleted**, and no staging login users were added. Unused temporary credentials were discarded. No production records were altered.
- Persistent staging company/user provisioning, real authenticated UI flow, mobile, print/physical QR, Cutting→Folding integration, multi-factory migration and legacy issue-writer reconciliation **remain pending**.

**Release gate:** This improves Fabric database verification but does **not** establish 21/21 Excel requirements as production-ready.
