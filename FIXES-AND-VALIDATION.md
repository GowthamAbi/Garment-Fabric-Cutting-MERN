# UG SaaS corrected build

## Runtime fixes

- Fixed seven React effects that returned promises as cleanup callbacks. This
  caused the production-only `TypeError: c is not a function` crash when
  navigating between Owner Sales, Subscription, Plans, Lead CRM, and Delivery
  pages.
- Confirmed payment company references are rendered as readable company names
  rather than raw populated MongoDB objects.
- Confirmed the shared data table safely formats populated object values.

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
