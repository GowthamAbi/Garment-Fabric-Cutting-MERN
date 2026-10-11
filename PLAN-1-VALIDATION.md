# Plan 1 — foundation fixes

Department users: nine downstream department values accepted by User schema; new department ID prefixes. Create user validates department and trimmed email before provisioning.

Account mail: shared provider send/timeout/error handling for activation and password reset. Production selects a public HTTPS CLIENT_URL from the configured origin list. Reset links are hashed, expire after 15 minutes and no longer report successful delivery after provider rejection. Unknown/known reset requests use a generic success message; provider acceptance is not proof of mailbox delivery.

User activation failure preserves the created account and returns FAILED. Customer administrators can resend from Users. Company activation continues to preserve its failed account. Duplicate database keys return safe 409; CastError returns safe 400. Forgot/reset/resend endpoints have process-local rate limiting; distributed limiting remains future work.

Run npm test in server and npm run build in client. Real database suites require disposable TEST_MONGODB_URI and are skipped without it. Production Resend configuration/delivery and logged-in browser workflows must be verified separately. No private tokens/passwords/API keys are included.

Plan 2 trial/billing work is outside this change.

Validation: server tests passed, frontend build passed and app import passed. Three real database suites skipped without staging MongoDB. Final test count recorded in commit summary. Existing PDF bundle size warning remains.
