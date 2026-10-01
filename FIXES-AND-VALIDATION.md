# UG SaaS corrected build

## Buyer-ready public website

- Added a dedicated public landing page at `/` with product positioning,
  department coverage, security details, packages and buyer calls-to-action.
- Kept the operational application protected at `/login`.
- Kept `/demo` public and read-only, using dummy data only.
- Connected trial, demo and sales requests to the public SaaS request API.
- Added `/privacy` and `/terms`, responsive styling and custom-domain routes.

## Runtime fixes

- Fixed seven React effects that returned promises as cleanup callbacks. This
  caused the production-only `TypeError: c is not a function` crash when
  navigating between Owner Sales, Subscription, Plans, Lead CRM, and Delivery
  pages.
- Confirmed payment company references are rendered as readable company names
  rather than raw populated MongoDB objects.
- Confirmed the shared data table safely formats populated object values.
- Fixed the anonymous customer-login flow. A normal 401 response from the
  initial session probe is now handled silently instead of showing the
  "Unable to Continue / Please login to continue" popup.

## Security and deployment

- Real environment files are excluded from the corrected package.
- Added safe `.env.example` templates for the client and server.
- Added repository-wide environment-file ignore rules.

## Validation completed

- Client production build: passed.
- Server test suite: 17/17 passed.
- Server JavaScript syntax scan: passed.

Copy each `.env.example` to `.env`, add your own secrets, and never commit
the resulting `.env` files.
