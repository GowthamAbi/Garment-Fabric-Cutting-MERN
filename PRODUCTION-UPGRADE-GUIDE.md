# UG SaaS Production ERP Upgrade

## Security model

- Every customer receives an isolated MongoDB database: `ugs_tenant_<company_key>`.
- Every customer receives a unique login URL: `/c/<company_key>/login`.
- A signed session contains both `companyKey` and `databaseName`; mismatches are rejected.
- Customer data is owned by the customer. The SaaS Owner sees tenant registry and billing metadata only.
- Customer production data is available to support only through a customer-created, time-limited, scoped, read-only support grant.
- Permanent DELETE requests are blocked. Business corrections use cancel, reverse, archive, deactivate or credit-note workflows.

## Local run

1. Install MongoDB 7+ and Node.js 20+.
2. Copy `server/.env.example` to `server/.env` and complete the values.
3. Copy `client/.env.example` to `client/.env`.
4. In `server`: `npm install` then `npm run dev`.
5. In `client`: `npm install` then `npm run dev`.
6. Open `http://localhost:5173/login` for the first Platform Owner setup.

Passwords require 12+ characters, uppercase, lowercase, number and special character. Do not use a personal name, email or User ID in the password.

## Company provisioning

When the Platform Owner approves a trial or creates a company, the server automatically:

1. Creates a registry entry in `ugs_control`.
2. Creates a dedicated tenant database.
3. Creates the company and factory records inside that database.
4. Generates an immutable User ID such as `UGS-MGT-GOW-1047`.
5. Sends an email activation link and the User ID. Passwords are never emailed.
6. Returns the unique login URL.

## Existing database migration

Take a MongoDB Atlas snapshot first. Configure `LEGACY_DB_NAME` in `server/.env`.

```bash
cd server
npm run migrate:dry
npm run migrate:apply
```

The script copies and verifies data. It does not delete or modify the legacy database. Keep the old database until customer acceptance is complete.

## Subscription invoice

- Razorpay/manual subscription records are tenant-owned.
- A billing approval request contains billing metadata only in the control database.
- Successful payment generates an immutable GST-ready invoice record.
- Company Admin can view, download PDF and email invoices.
- Configure legal name, address, GSTIN, state code and SAC in environment variables. Confirm tax/SAC configuration with the business accountant before production use.

## Production launch checklist

- Configure MongoDB Atlas backups and point-in-time recovery.
- Use an always-on API instance; avoid cold-start hosting for ERP login/API.
- Configure Resend verified domain and `EMAIL_FROM`.
- Configure Razorpay live keys and webhook secret.
- Use a random JWT secret of at least 64 characters.
- Restrict `CLIENT_URL` to exact production/staging domains.
- Run `npm test` in `server` and `npm run build` in `client`.
- Complete staging UAT with one pilot company before production migration.
- Test restore from backup before onboarding paying customers.

