# UG SaaS staging bootstrap (live ugsaas.com remains untouched)

**Current state:** This repository contains preparation safeguards, not a deployed staging website.

## Topology

| Component | Live | Staging (create separately) |
|---|---|---|
| Frontend | ugsaas.com / production Netlify | Separate Netlify preview or staging site, built from this draft PR branch |
| Backend | api.ugsaas.com | NEW Render web service with independent URL |
| MongoDB | Production Atlas/control/customer databases | NEW disposable MongoDB Atlas replica-set-capable cluster, dedicated account |
| Email/payments | Live delivery and merchant | Keep disabled for initial staging, use only test-mode integrations later |

### 1. Prepare disposable MongoDB
Create a **separate test-only Atlas cluster, test database user and network controls**. Reusing a production cluster, database user or URI is not considered isolated. Do not restore live customer data or reuse a production encrypted customer database connection. Back up any existing live data independently before future production changes.

### 2. Create a new Render staging backend
Create a NEW service from the feature branch; never repoint the live Render backend. Set private environment values **in Render UI, not in Git**:

```dotenv
APP_ENV=staging
NODE_ENV=production
STAGING_ISOLATED_DATA_ACK=true
MONGODB_URI=<dedicated test-cluster URI, stored privately>
CONTROL_DB_NAME=ugs_stage_control
TENANT_DB_PREFIX=ugs_stage_tenant_
JWT_SECRET=<new unique random 32+ character secret>
TENANT_CREDENTIAL_KEY=<new unique random 64-digit hex key>
CLIENT_URL=https://<your actual Netlify preview hostname>
AUTOMATION_ENABLED=false
```

For initial staging, leave `RESEND_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` unset. Do not share credentials in chat. `STAGING_ISOLATED_DATA_ACK` acknowledges human verification of the separate test cluster; it is **not proof** by itself.

Use server root directory for Render, build `npm ci`, start `npm start`; verify `/health` and `/ready`.

### 3. Configure Netlify preview
For the preview deploy context **only**, set `VITE_API_URL=https://<staging Render service hostname>/api`. Do not set production `https://api.ugsaas.com/api`. The frontend build and runtime refuse an unconfigured/production backend on a preview origin. Configure a staging-only `CLIENT_URL` on the backend matching the exact HTTPS preview hostname. Netlify preview must not use the production database or payment provider.

For predictability, a separate Netlify site using the feature branch and exact staging API variable is safer than relying on a shared site's global environment variable. If deploying as a shared site's preview, inspect the *effective deploy-context variables* before building.

### 4. Initialize isolated dummy test users
Create only fake companies, factories and role accounts (Owner, Company Admin, Factory Manager, Department Head, Staff). Never reuse a real person's credentials. Provision approval limits and per-department grants explicitly. Test via `docs/approval-staging-acceptance.md`.

### 5. Run acceptance and rollout gates
- GitHub Actions unit tests + frontend build (should not need staging secrets).
- In isolated staging, run the real MongoDB transaction/rollback suites using a test-only `TEST_MONGODB_URI` (and second test Atlas URI when required). Never point tests at the production cluster.
- Test roles, company/factory entitlements, approvals, status transitions, audit replay and concurrency with disposable data.
- Verify browser/mobile flows and UI/print/QR independently.
- Review deployment rollback, backup restore, monitoring and company billing with test accounts.
- Do not merge the draft PR to main or deploy to production until these checks pass and the owner explicitly approves release.

## Why preview isolation is required
Before this update, a frontend without `VITE_API_URL` defaulted to `https://api.ugsaas.com/api` outside localhost. A staging or deploy-preview site could accidentally mutate live data. The new checks intentionally fail the build or browser initialization instead of silently selecting the live API. This might block old preview deployments until their staging backend is ready; that is expected and safer.

## Current resources provisioned on 15 October 2026
- **Isolated Atlas project:** `UG SaaS Staging`; cluster `UGS-Staging`, AWS Mumbai, Free tier. The live `Jarvis` cluster was not modified.
- **Staging API service:** [ugsaas-staging-api](https://dashboard.render.com/web/srv-db86sju89jmc73cev0tg), URL `https://ugsaas-staging-api.onrender.com`; deploy is not healthy until `MONGODB_URI` and network allowlisting are configured.
- **Staging frontend:** [ugsaas-staging-ui](https://dashboard.render.com/static/srv-db86ucmq1p3s739qkfk0), URL `https://ugsaas-staging-ui.onrender.com`, deployed successfully; its `VITE_API_URL` targets only the staging API.
- Staging backend has fresh `JWT_SECRET` and `TENANT_CREDENTIAL_KEY`; securely back up the tenant encryption key before using customer credential storage.
- **Owner action:** In Atlas staging project reset `ugs_staging_app` password if not recorded; obtain Render staging service **Connect → Outbound** IP ranges and add them to staging Atlas network access. Configure the resulting *staging-only* MongoDB URI directly in Render Environment. Never paste passwords into ChatGPT/GitHub.
- After credentials and network are configured, verify Render `/ready`, run the MongoDB replica-set integration suite with disposable testing databases and complete the [approval acceptance matrix](./approval-staging-acceptance.md).
- Render static sites with React Router may need **Redirects/Rewrites** rule `/*` → `/index.html` (Rewrite); configure through staging static site's dashboard if nested paths return 404.
