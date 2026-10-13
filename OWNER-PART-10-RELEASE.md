# Part 10 — Reproducible acceptance runner

## Added
- `scripts/acceptance.py` runs server tests, frontend production build, both layout render checks and verified source ZIP packaging. It writes command logs and machine-readable acceptance.json outside the repository.
- `scripts/layout-smoke.mjs` preserves the Part 8 render initialization check in source, catching errors such as reading user before initialization. It does not simulate logged-in browser interactions.
- `--require-database` fails the command when TEST_MONGODB_URI is missing, a database test skips or server tests fail. Ordinary local mode permits pending database acceptance and reports it explicitly.
- Email, payment, device/browser, backup restore, accounting/QR and full workflow gates remain pending; productionReady stays false. The runner does not send messages, create payments or deploy.

## Use
1. Install locked dependencies: `npm ci --prefix server` and `npm ci --prefix client`.
2. Local checks: `python scripts/acceptance.py --output ../acceptance-report`.
3. Real database checks: supply TEST_MONGODB_URI through a private environment pointing at a disposable transaction-capable test replica set; then run `python scripts/acceptance.py --output ../database-acceptance --require-database`.
4. Review acceptance.json and logs. The test fixtures create/delete isolated test databases; never use production credentials. Reports may contain database errors, so keep them private.
5. Complete the live/manual checklist in OWNER-PART-9-RELEASE.md before commercial deployment. A zero exit in local mode means local checks passed, not production acceptance.

## Verification
- Local runner: server 148 passed, 0 failed, 7 skipped; frontend build, both layouts and package verification passed.
- Strict database mode with no TEST_MONGODB_URI: correctly returns non-zero and reports database acceptance pending.
- Live provider and physical-device acceptance remain unavailable in this environment.
