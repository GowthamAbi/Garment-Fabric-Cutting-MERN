# UG SaaS Approval — Staging Acceptance Gate

This document is an **unexecuted acceptance plan**, not proof that the product is release-ready.
Operate only against a dedicated non-production company and replica-set-capable MongoDB database.
Never use real customer records, production credentials, live payment methods or live stock.

## Prerequisites
- A staging deployment that builds from this PR branch (not from `main`).
- Dedicated staging customer with two factories, one enabled and one disabled department.
- Active subscription covering tested departments.
- Separate staging accounts: Company Owner, Company Admin, Factory Manager, Department Head and Department Entry Staff.
- Approved staged approval limits for all request types, test amounts below HEAD, between HEAD/FM, between FM/OWNER and above OWNER.
- Two company records to test cross-company isolation. Use disposable accounts and resettable database snapshots.
- MongoDB replica set or managed cluster with multi-document transactions; source operational DB and platform audit DB may use different connections.

## Required security and workflow tests
| ID | Scenario | Expected result |
|---|---|---|
| A01 | Staff creates request in licensed department | 201; request and operational audit outbox commit together |
| A02 | Head approves within configured threshold | APPROVED with approver and reason |
| A03 | Head approves above HEAD limit | Escalated to FM, not posted to inventory |
| A04 | FM approves above FM limit | Escalated to Owner |
| A05 | Owner approves within OWNER limit | APPROVED once |
| A06 | Owner tries to approve above OWNER limit | Denied; owner can explicitly reject |
| A07 | Requester attempts to approve own request | 403 |
| A08 | User from another factory/company reads or decides | Denied/no document exposed |
| A09 | Disabled/unlicensed department sends request | 403 |
| A10 | Head tries to approve a different department | 403 |
| A11 | Two reviewers concurrently act on one version | Only one decision commits; other receives conflict |
| A12 | Force audit outbox write to fail inside transaction | Neither request nor decision change persists |
| A13 | Run audit synchronization twice | One destination audit event per sourceEventId; delivered source marked |
| A14 | Owner revokes approval grant | Reviewer cannot continue after required new sign-in |
| A15 | Company Admin changes ordinary permissions | Existing owner-controlled approval grants retained |
| A16 | Staff / Head attempts grant assignment or owner limit update | 403 |
| A17 | Review request and decision history in mobile viewport | No hidden action, overflow, or incorrect affordance |
| A18 | Compare stock, cost, accounting before/after approval-only flow | No accidental operational posting |
| A19 | Audit sync fails mid-batch and is retried | All committed outbox events converge without duplication |
| A20 | Staging tenant without replica-set transactions | Explicit error; no silent non-transactional fallback |

## Release blockers
- Run the full GitHub Actions suite and all DB-backed tests. A green unit build with skipped integration tests is not enough.
- Review actual authorization middleware against deployed auth tokens, active permissions, factory scoping and department licensing.
- Validate migration/index creation for unique `AuditLog.sourceEventId` on staging data.
- Confirm approved limits and default grants with Company Owner; do not provision authority implicitly.
- Test backup+restore, deployment rollback, alerting and log retention.
- Manually sign off mobile/browser journeys. PR remains draft until review approval.

## Information needed from owner (without sharing secrets in chat)
- Non-production staging URL, or confirmation only live site exists.
- Whether a disposable staging MongoDB replica set/cluster is available.
- Preferred staging company and test factory names (dummy data only).
- Staging sign-in can be completed interactively in a secure browser workflow; never paste passwords here.
