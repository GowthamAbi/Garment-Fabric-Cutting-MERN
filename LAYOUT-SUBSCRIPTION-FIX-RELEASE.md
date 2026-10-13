# Layout and subscription catalogue correction

## Concrete source fixes
- SaasPlan is a platformRegistry schema. It must not inherit company/factory query scoping. Previously a tenant read could see zero central plans and attempt duplicate seeding.
- Seeding now upserts each missing code with $setOnInsert, never overwriting owner-customized price/modules. A duplicate race is accepted only when the requested plan now exists.
- Companies displays Workspace status instead of incorrectly calling TenantRegistry ACTIVE a paid subscription. Payment capture rules remain enforced.
- Company and plan screens have explicit loading and retry states; failed loading is not reported as a confirmed empty list.
- Shared screen-only flat styling replaces operational gradients/shadows with aligned controls, thin separators, compact tables and mobile form/action wrapping. Dark colors are retained. Print styles remain separate.
- Plan descriptions explain that capacity and licensed department coverage are separate. Existing plan licences are not expanded automatically.

## Verification
154 server tests passed, 0 failed, 7 real database tests skipped. Frontend build passed (large-chunk warning remains). Both layout render smoke checks passed. New tests cover platform plan schema isolation, repeatable seeding with customized values and duplicate-race handling.

## Not claimed complete
This is a source fix, not a retest of QA company ug-qa-test-20261013. Deploy and revisit Subscription Plan before confirming F01 resolved live. Existing Enterprise modules need owner review in Plans to enable the intended 14-department QA licence; no production customer is granted extra departments silently.

Exact Factory Admin mapping remains Company Admin with explicit assigned-factory scope/custom role, not an introduced unrestricted Factory Admin role. Full role acceptance remains pending.

All page-by-page desktop/mobile/browser, realistic data, physical print/QR and end-to-end workflow acceptance remains pending. Generic CSS and server-render checks do not demonstrate that every layout is visually correct. Retest the interim report cases after deployment, then record evidence and remaining defects.
