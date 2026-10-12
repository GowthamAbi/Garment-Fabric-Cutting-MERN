# Owner Part 8 — Display, profile help and responsive layout

## Changes
- Sun/Moon/Monitor buttons select light, dark or device theme; preference is retained locally, with accessible labels and pressed state.
- Company and SaaS owner headers expose Profile settings, contextual help and the complete workflow guide through a Profile dropdown. Escape and outside click close the dropdown.
- Help includes factory setup, factory switching, purchase order cancellation/archive, subscriptions, production, retail, payroll review, security and common actions.
- Dark styles cover profile panels, controls, statuses, disabled fields and placeholders. Mobile forms/action groups wrap; table containers retain horizontal scrolling. Reduced-motion preferences are respected.
- Fixed MainLayout reading `user` before its declaration, which could crash rendering despite a successful build. Removed mistakenly embedded menu objects from the company role list.

## Verification
- Frontend production build: passed (existing large-chunk warning remains).
- Company and SaaS owner layouts: server-render smoke checks passed. This catches render initialization failures; it does not test browser interaction.
- Server code unchanged. Part 7 server results remain historical: 148 passed, 7 live database tests skipped.

## Acceptance still required
- Logged-in desktop/mobile Chrome, Firefox, Safari and physical device visual checks, including print/QR and keyboard interactions.
- Confirm contrast and overflow on each operational screen with realistic data; responsive CSS is not proof of all device acceptance.
- Existing 30-minute inactivity locking, authentication and offline device unlocking were retained, not re-certified in this release.
- Live email/payment/database acceptance and final release packaging remain Part 9 work.
