# Owner Part 6 — document approval limits, escalation and audit

## Implemented
- Existing ERP document approval queue now enforces registered reviewer IDs and per-document INR exposure limits. Actual server-planned exposure (gross, journal debit or issued stock value, whichever is greatest) is checked in the posting transaction. Client amounts cannot bypass the limit.
- Approval decisions also require the current user's permission to post that document type and its subscribed feature. A company-admin role name cannot bypass financial permissions through the approval queue.
- Policy configuration requires company policy administration permission. Threshold/type/reviewer/escalation changes are proposals; a different policy administrator must approve the current proposal ID with APPROVE POLICY and review notes. Old active policy remains in force until approval. Reviewers must be active company users assigned to the factory.
- New requests record policy revision and due time. The approval screen refreshes every 30 seconds while visible, marks overdue PENDING requests and directs escalation to Company Owner. No overdue request is automatically approved.
- A reviewer/policy administrator can queue an overdue alert to the verified company-owner email. This is an explicit button action, deduplicated per factory per UTC day; it is not automatic scheduled email. Resend configuration and the existing automation worker are required for actual delivery. Queued is not inbox delivery.
- Submission, approval/rejection, policy proposal/approval and successful document posting record append-only hash-linked audit entries, with actor, reference, reason/revision and relevant posting exposure. Policy/decision audit writes are atomic with their state changes; POSTED audit is atomic with the ledger. Each hash includes company/factory identity. Update/delete operations on this audit model are blocked.
- Audit readers can verify row hashes and chain continuity over the latest 200 entries. Chain continuity outside the fetched window is reported as unknown. Infrastructure credentials can still rewrite storage; independent protected backups remain necessary.
- Approval queue data is filtered by the requester's own records or actual posting permission. Failed posting remains APPROVED and can be rejected/resubmitted to another eligible reviewer; a successful repeated posting remains idempotent.

## Validation
150 tests: 144 passed, 0 failed, 6 skipped. Frontend production build passed; existing large-chunk warning remains. Added policy tests cover paise validation, reviewer caps, owner/configured-reviewer boundaries, financial permission denial, due-time escalation and hash tampering. Anonymous HTTP checks include policy, approval and escalation writes.
Added a replica-set acceptance test for independent policy approval, insufficient reviewer limit, unauthorized finance rejection, no ledger writes on failed posting, simultaneous exactly-once posting and immutable/hash-linked audit. It is skipped without TEST_MONGODB_URI, alongside the five previous live database tests. Live Resend escalation, logged-in browser acceptance and real database transactions were not executed.

## Use
1. Grant a second administrator explicit company.settings permission and relevant posting permissions using Part 2. Independent review cannot be performed by the proposer.
2. In ERP → Approvals, select approval document types, threshold, reviewer IDs/limits and escalation hours; enter a change reason and propose the policy.
3. Another authorized policy administrator reviews the pending proposal and types APPROVE POLICY.
4. Submit documents through New document → approval queue. An independent configured reviewer reviews/posts. Actual exposure over the reviewer cap denies ledger posting.
5. Review overdue flags, use the owner-alert button if needed, and inspect the approval audit chain.

## Boundaries / compatibility
Limits apply per core ERP document, not daily aggregate spend or every department-specific event. Department movements, ownership/delegation changes, payroll, route/BOM approvals and stock-exception workflows retain their existing specialized guards; this release does not claim universal multi-level approval for every action. Multi-level chains and automatic scheduled escalation email remain future extensions. Legacy policies keep their prior reviewer-role behavior until a new policy is independently activated, while current posting permissions are checked for all decisions.
Existing historical approvals are not retroactively hash-certified. New audit entries begin the new chain. Release remains subject to real database, device/browser, email and accountant acceptance before commercial rollout.
