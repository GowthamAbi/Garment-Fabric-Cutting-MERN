# Companies API fix — 9 October 2026

The owner company-list query omitted databaseName. For registry entries without adminUserId, the fallback administrator lookup then failed with "Explicit workspace context is required for tenant data". The query now includes databaseName for the internal lookup and removes it from the response.

Unhandled server errors now log their stack to server logs while production responses retain the generic message.

Validation: 70 backend tests passed, 3 database integration tests skipped, 0 failures. Includes a regression test for legacy admin lookup, tenant isolation, existing admin metadata, missing admins and private database names. No live database or deployment was accessed.

## Deploy
Replace these files in the existing GitHub repository (paths relative to project root):
- server/src/controllers/companyController.js
- server/src/middleware/errorHandler.js
- server/tests/companyList.test.js

Commit and push, then Render Manual Deploy > Deploy latest commit if auto-deploy is disabled. Refresh Companies and confirm GET /api/companies returns 200. If a 500 remains, capture the new server error log. No database deletion, reset, or environment-variable change is required for this patch.

Custom-domain and DNS configuration are separate and are not changed by this ZIP.
