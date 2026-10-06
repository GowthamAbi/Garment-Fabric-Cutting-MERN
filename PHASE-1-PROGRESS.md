# ERP development milestone 1

Implemented: consolidated browser API requests; invalid workspace rejection;
explicit tenant database context; disabled public owner registration;
private transactional owner bootstrap; central subscription invoice sequence;
excluded users and support grants from customer JSON exports.

Run private setup only when no owner exists:
`node server/scripts/bootstrap-owner.js` from the project root with securely configured
MONGODB_URI, OWNER_NAME, OWNER_EMAIL and OWNER_INITIAL_PASSWORD.
Existing owners are not changed. MongoDB transactions require a replica set/Atlas.
Do not publish secrets. Remove the initial password environment variable after setup.

Not yet complete: permissions refresh and endpoint scope coverage; support read audits;
payment idempotency and recovery; encrypted backup/restore; unified stock ledger;
sales, purchase, quality and accounting expansion. This is a development milestone,
not a production-certified ERP. Test with a staging database before deployment.

Existing invoice numbers are not renumbered. Before issuing invoices from this upgrade,
reconcile previously issued numbers and seed the central financial-year counter.
