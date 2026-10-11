# Device layout, appearance, help and session security

## Changes
- Mobile: wrapping page headers, full-width display controls, responsive ERP grids, horizontal table scrolling, 44px touch controls, 16px input text and bounded dialogs/sidebar. Desktop retains sidebar and full tables.
- Light/Dark/System theme selection in company and owner headers; preference persists. Print documents retain a white background.
- How to use opens a keyboard-accessible modal with current-page workflow, Save/Post/Retry/Print/Approve/Reverse explanations and access/subscription guidance. See USER-OPTION-GUIDE.md for the complete department action sequence.
- Client inactivity lock after 30 minutes, including background-tab sleep/reopen. Trusted pointer/keyboard/touch/scroll input updates the activity timestamp. API polling alone does not reset client physical-activity timeout.
- Logout clears private UI immediately, persists a company-local lock and propagates it to other tabs. Refresh/back does not unlock it. Fresh successful login clears the lock. Server revocation is attempted; offline logout cannot guarantee a server request succeeded. Company offline catalog is removed while pending drafts are retained for reconciliation.
- Server rejects ordinary authenticated requests after 30 minutes without account API activity and checks session-version revocation while touching activity. This is account-level API activity, not a separate persisted session per device. Authorized support tokens retain their grant expiry/scope policy.
- Existing private routes remain behind login and scoped API authorization; marketing/demo/legal pages stay public. Offline POS requires previous authenticated enrollment and a device passphrase, not an anonymous company data endpoint.

## Verification
- Server tests: 118 passed, 0 failed, 4 skipped (122 total). Added exact idle-boundary, malformed/future timestamp and legacy-token fallback checks.
- Frontend production build passed.
- Live Chrome check: opening a company bundle URL without login displayed the company login form and did not display bundle data. This verified the existing deployed guard, not this release's new UI.
- New authenticated desktop/mobile visual acceptance, real multi-tab/background-timeout exercise and phone/browser offline flow have not been performed. The remote browser cannot render this un-deployed local build and no authenticated test user or viewport-emulation capability was available. No passwords were entered.

## Deployment acceptance checklist
1. Deploy client and server together; sign in freshly (older idle sessions may require login).
2. Test widths 360, 390, 768, 1024, 1440: open/close menu, every module, form validation, keyboard guide/Escape, tables and receipt/QR printing.
3. Check Light/Dark/System, focus contrast, OS-theme change and printed tax documents.
4. With no login, open private deep links, use browser back/refresh and call private API: no private data should appear; APIs must return 401.
5. In a staging session, let physical inactivity exceed 30 minutes, then resume a suspended tab: workspace must lock before editing. Active user input should preserve the client session; server API idle expiration may still require re-login.
6. Logout from one tab; another tab, refresh and back must remain locked. Test network unavailable logout; retry sign-in only online and verify revocation behavior.
7. Offline device enrollment/unlock is a separate explicit workflow. Logout removes the saved catalog; unresolved cash drafts must remain available for later authorized reconciliation.

Do not mark production device acceptance complete based solely on a successful build or the one unauthenticated live-route check.
