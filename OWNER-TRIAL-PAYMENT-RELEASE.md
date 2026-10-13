# Owner email, display and 14-day trial/payment update

Includes the preceding owner console fixes.

- Companies → Edit email updates the registered administrator identity and central email reservation transactionally, revokes old sessions/reset links and requires a new email verification. Failed delivery is shown as FAILED; resend remains available. Requires a MongoDB replica set and configured Resend sender.
- Removed the top Profile control. One animated accessible Sun/Moon switch remains in the top-right corner at desktop/mobile widths. Sidebar profile/account controls remain available.
- Newly provisioned paid-plan companies can choose Start 14-day trial or Payment on the first subscription screen. Trial is limited to one start per company and unavailable after paid/refunded history. Existing selected departments are retained; the introductory trial supports 14 selected departments and 15 seats (administrator plus one per department), with ERP Core. Paid feature sets are quoted separately.
- Starting a trial uses a transaction and records usage centrally and in the tenant company. Concurrent requests cannot restart or extend it. Existing trials retain their recorded expiry; the duration change does not silently extend existing customers.
- Own Plan selection is remembered through the trial. Paid quotes use server-configured per-department pricing, seats, setup and GST. The screen shows selected count, rate, subtotal, GST and total. Manual requests remain pending until approved. Razorpay activates only after verified captured payment; a checkout success alone is insufficient.
- The bell shows current subscription/trial/payment status and opens renewal. Existing automation queues reminder emails at 7, 3, 1 and 0 days from expiry, now including verified company owner accounts. Email reminders require AUTOMATION_ENABLED and working provider configuration. No real emails or payments were sent during this development.
- Removed the invalid 30-day validity override from the company Activate action.

Validation: 166 server tests, 159 passed, 0 failed, 7 skipped (dedicated staging replica-set credentials required). Client production build passed with existing bundle-size warnings. Source syntax and whitespace checks passed.

Still required on staging: actual email-edit verification/session revocation, duplicate/concurrent trial start, manual and Razorpay settlement, notifications/worker delivery, department user creation, phone/tablet visuals, keyboard use and real browser acceptance. The browser credential-state restriction prevented visual retesting. This change does not enable provider secrets, automatically create department users or certify live deployment.
