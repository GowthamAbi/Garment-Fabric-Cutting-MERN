# Customer Data Isolation

## Databases

- `ugs_control`: platform owner, plans, leads, tenant registry and billing approval metadata.
- `ugs_tenant_<company_key>`: customer users, operational records, audit logs, invoices and backups.

The platform owner cannot query tenant models with the platform session. A customer support grant is required to create a one-hour read-only support token. The grant includes permitted modules and can be revoked immediately by the Company Admin.

## Authentication

- Login requires company URL/company key, immutable User ID and password.
- Session is stored in a Secure, HttpOnly cookie.
- Five failed login attempts lock the account for 15 minutes.
- Password reset token is one-time, hashed and expires after 15 minutes.
- Email verification token expires after 24 hours.
- Password change/reset increments `sessionVersion`, revoking earlier sessions.

## Retention and audit

- Permanent DELETE API operations are disabled.
- Issued invoices cannot be deleted.
- Mutations record User ID, role, company, factory, IP, user agent, action and sanitized changes.
- Backup exports operate on the current tenant database only.

