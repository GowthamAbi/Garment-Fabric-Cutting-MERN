# Owner requirements Part 2 access foundation

## Delivered
- New companies provision a distinct company_owner identity, persist ownerUserId and verify that identity on every authenticated owner request. Company owner is not a platform owner. Regular user creation, assignment and update cannot create/transfer/downgrade the owner identity.
- Strict company admins do not inherit financial posting, department access or location access from their role name. Assigned permission keys control ERP finance/read/post, department operations, user administration, custom roles, support and payroll access.
- Immutable custom role versions, permission catalogue and standard Company/Factory/Warehouse/Shop/Marketing/Accounts/Purchase/Product/Dispatch/Auditor/Payroll/Department templates. Role creation and assignments record audit entries; assignments increment session version.
- Company, Location, Department and Self scopes. Company scope covers the company's factories; Location scope uses reviewed factory IDs and factoryId:warehouseCode / factoryId:shopCode assignments. Department scope rejects broad ERP/legacy reports. Self currently supports personal profile only.
- Delegators cannot grant permissions they lack, broaden their scopes, assign a target outside their factories, alter their own access or change an owner through the role endpoint.
- User Management contains role creation/assignment controls and active-factory switching. Factory switching validates assignment, revokes sessions and records audit. Warehouse/shop scope checks apply to downstream bundle reads, transfers, exceptions, trace and reversal. Scoped users cannot access unfiltered ERP factory reports through warehouse/shop permissions.
- Strict legacy Fabric/Cutting/Elastic/Accessories/Delivery endpoints have explicit mappings; unmapped legacy endpoints deny instead of relying on an admin role. Strict non-company aggregation adds active-factory filtering. Existing legacy-policy behavior is retained until reviewed migration.
- Payroll read, preparation and approval are separate grants. Salary GL posting also requires account posting, and strict preparers cannot approve their own salary accrual. Role templates do not imply automatic statutory filing/payment.
- Owner email changes are blocked in the generic profile endpoint. Strict password changes require current-password verification. Support issue/revoke remains company-owner-only under strict policy to prevent delegated access expansion. Access-boundary denials are audited.

## Existing-company adoption
No company or user was migrated live. Use `node server/scripts/adopt-company-owner.js` for a dry review with private MONGODB_URI, OWNER_COMPANY_KEY and OWNER_USER_ID. It requires the original registered administrator, matching registry email and verified active account. Apply additionally requires `--apply`, OWNER_ADOPTION_CONFIRMED=YES and OWNER_REVIEW_REFERENCE from an independent ownership review. It refuses transfer to another owner and performs identity/company/audit changes transactionally.

Applying company strict policy makes other legacy users profile-only until explicitly assigned reviewed roles/scopes. Schedule that change and prepare user assignments first; it intentionally does not silently turn every old admin into an unrestricted owner. No operational data is erased or moved. Re-login is required.

## API and use
- GET /api/auth/access: templates, delegable catalogue, current factory users and immutable company role versions.
- POST /api/auth/access/roles: create a new role key/version; no implicit editing of existing grants.
- POST /api/auth/access/users/:id: choose roleKey, accessScope, department where relevant, assignedFactoryIds and location keys. This freezes permissions and revokes old sessions.
- POST /api/auth/access/factory: change own active factory then sign in again.
- Use specific location assignments for warehouse/shop staff. A company-scope assignment is broader and should be reviewed intentionally.

## Limits and pending acceptance
This is the access foundation, not complete acceptance of every Owner.docx role/module. Business-group cross-company management, general self/assigned-order access, ownership transfer/contact-change verification workflows and some legacy production/report endpoints are not implemented. Unmapped endpoints deny strict users. Factory creation screens are Part 7; configurable approval thresholds/escalation and additional critical financial controls are Part 6.

Location codes are validated against assigned company factory IDs and delegation boundaries; the assignment form requires the operator to review existing warehouse/shop codes. There is no automatic migration of old custom permission strings into a new owner grant. Standard templates are starting points, not jurisdictional or payroll compliance certification.

Validation: 127 passed, 0 failed, 4 skipped (131 total). Frontend production build and application import passed. Tests cover owner/self protections, delegation, cross-factory and location denial, strict admin finance denial, self/department boundaries and legacy endpoint classification. Live role/ownership migration, real multi-user database transactions and authenticated browser acceptance have not run.

Deploy the full repository including shared/. New company onboarding still has the paid-plan activation issue assigned to Part 3; this release is not a commercial production acceptance certificate.
