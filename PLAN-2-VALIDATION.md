# Plan 2 — trial and subscription access

New approved trials last exactly seven days from approval; existing live expiries are preserved. Owner-created Trial companies also use seven days. Public approval snapshots current Trial user/department/module entitlements. Activation verification is still required.

Authenticated customers have /api/saas/access-status outside the business expiry gate. Layout shows trial remaining days, near-expiry/expired subscription notices and Upgrade/Renew navigation. Owner overview includes expired/expiring trial counts plus its existing expiring companies list. Business routes reject expiry at the exact boundary and missing/invalid expiry; billing routes remain available. No payment failure extends access; payment settlement changes belong to Plan 3.

Renewal worker queues trial-labelled reminders at stable 7/3/1/expired thresholds, keyed by company, expiry and threshold. Missed daily runs do not skip a threshold permanently. Expired data is retained. AUTOMATION_ENABLED=true and valid Resend configuration are required for actual sending. Cancellation suppresses reminders as before.

Tests/build run locally. Real MongoDB suites and provider delivery require staging verification; no claim of actual delivery. Existing Trial seed record validity is not rewritten; approval uses the seven-day policy. Existing trials are not shortened.
