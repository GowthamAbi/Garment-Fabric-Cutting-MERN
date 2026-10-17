# UG SaaS — Phase 2 P0 Batch 01: Role Assignment & Data Isolation
Date: 2026-10-17

## Why this was selected first
Book1.xlsx critical items **A49 Create User, A50 Create & Assign Role, A51 Edit/Deactivate User, A52 Permissions, A106 Security** touch authorization and customer data. P0 audit priority is protection against privilege escalation before expanding UI and workflows.

## Code hardening
1. Shared `assertSafeBaseRoleAssignment` denies creating, assigning or modifying `company_admin` and `admin` base roles without customer `company_owner` authority. This protects legacy role-gated routes where the base role itself is significant even if permissions array is empty. Customer support roles are denied. Platform provisioning retains ordinary staff-account creation for compatibility, but platform-issued `company_admin` or `admin` base roles remain denied.
2. Enforced at `/auth/users` creation, `/auth/users/:id/permissions`, legacy `/companies/:id/users/:userId` update and `/auth/access/roles` and `/auth/access/users/:id`. Strict-policy legacy role change must use audited role assignment workflow. Existing site customers on legacy access policies still cannot promote admins without owner.
3. `/auth/access` directory listing now uses a scope filter including company/factory and (when applicable) department. Factory-scoped roles don't enumerate other factories or receive other factory locations in the `company.factories` response. Templates are filtered by delegability and sensitive base role.
4. The legacy company-wide `/companies/:id/workspace` aggregation containing staff/audit is blocked for strict policy actors whose accessScope is not `COMPANY`. The requested company ID must equal the authenticated company ID.
5. Owner, company-admin and role-assignment negative tests added. No changes to approval, stock posting, live tenants, production `main`, Netlify environment or customer credentials.

## Verification
The code hardening does not mean these Excel cells are user-accepted. Source status stays **UNVERIFIED** until role-wise authenticated browser workflow, factories A/B, company/company-admin negative tests, user activation/deactivation, audit log persistence, mobile form, and UAT screenshots are checked. No change made to all 466 catalog statuses.

## Next P0 tasks
- Full HTTP/database integration of these access endpoints under real tenant transactions, including legacy migration permissions, role revocation and session invalidation.
- A106 Security: user-management audit logs and organization-wide directory/privacy/retention controls.
- D5/D67–D72/A73–A76: approval queue tenant/factory/decision grant boundary verification.
- A14–A27/D20/D48: stock/low-stock alerts and double-posting controls.
- A10/A43–A46/A81–A94: finance, purchases, billed source journals, subscription and tax reviews.

**Release gate:** Run both GitHub CI workflows on the final commit and keep the PR draft; staging/real end-user acceptance remains separate.
