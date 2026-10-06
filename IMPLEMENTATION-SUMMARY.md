# UG SaaS Production ERP — Implementation Summary

## Delivered in this build

- Database-per-company multi-tenancy with cached Mongoose tenant connections.
- Unique company key and login URL (`/c/<company-key>/login`).
- Signed tenant binding in every session and cross-company mismatch rejection.
- Customer-owned data policy; Platform Owner cannot open customer workspace data by default.
- Customer-issued, time-limited, module-scoped, read-only support grants.
- Permanent deletion protection and tenant-only backup export.
- Immutable User IDs (`UGS-DEP-NAM-0000`).
- User ID + password login instead of email login.
- 12+ character strong-password validation on server and client.
- Account lock after five failed attempts.
- Email verification, 24-hour activation links and 15-minute password-reset links.
- Session revocation after password reset/change and inactivity logout.
- Subscription billing request separation between control and tenant databases.
- Razorpay/manual payment workflow foundation.
- GST-ready immutable subscription invoice records.
- Customer invoice list, PDF download and email actions.
- Customer billing/GST fields and invoice sequence by financial year.
- Audit logs include immutable User ID and sanitized changes.
- Existing shared-database dry-run/apply migration script; source data is never deleted.
- Frontend vendor chunk splitting.
- Production environment template and deployment/migration/security documentation.

## Existing ERP modules retained

Fabric, inward, roll QR, production plans, folding, cutting stock, machine planning, time status, Gantt reports, accessories PO/stock, elastic production, stitching, delivery/vendor/DC, reports, audit/backup, CRM, owner plans and subscriptions remain included.

## Verification

- Server automated tests: 21 passed.
- Client production build: passed.
- JavaScript syntax checks: passed.

## Required external configuration

MongoDB Atlas, verified email sender, Razorpay live account, GST/legal invoice information and production domains are external services/configuration and are intentionally not embedded in source code.

