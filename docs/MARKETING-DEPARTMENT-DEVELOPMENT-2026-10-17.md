# UG SaaS — MARKETING Department (17 October 2026)

**Source workbook:** 20 options, Head F380–F389 (10) + Staff F392–F401 (10).  
**Feature branch:** feature/department-role-sidebar-foundation-20261015; draft PR #1. Do not merge main or write production tenants.

## Implemented development
- Reuses real Shop sales and stock based forecasting GET /marketing/analysis (7–365 day history); existing audited replenishment Demand + independent company-admin approval.
- New scoped MarketingLead, MarketingActivity, MarketingCampaign and MarketingExpense. New read-only /marketing/overview and idempotent audited lead registration, pipeline-status update, enquiries, followups, customer communication logs, order followup notes, campaign budgets and expenses. Backend permissions apply to all.
- Communications are a **record-only log**: no email/WhatsApp/SMS is sent. Order followups are manually entered references, not integrated order statuses.
- Marketing expenses are **planning/management records only**, not ERP account postings. Store INR amounts in paise, print/export INR.
- Head dashboard + reports and staff registration, enquiry, followup, demand, campaign, communication and history screens. Each of 20 Excel entries navigates to a real shared or specific screen. Followup calendar is saved date list, not automated notification.
- Shop Gross Invoice KPI does not subtract refunds; do not label as net recognized revenue.

## Head / Staff Excel mapping
Head: F380 dashboard; F381 performance; F382 sales analysis; F383 lead pipeline; F384 order followups; F385 replenishment forecast; F386 expenses; F387 approvals; F388 team tasks; F389 reports.

Staff: F392 dashboard; F393 lead registration; F394 enquiry; F395 followup; F396 demand; F397 campaign; F398 communication internal log; F399 calendar/date list; F400 history; F401 reports.

## Remaining acceptance and roadmap
- Client privacy/consent, encryption, field access segmentation, retention and deduplication, lead import.
- Real ERP order followup integration; email/WhatsApp sends, calendar notifications, marketing campaign ROI.
- Finance/AP voucher for expenses, receipts and accounting approvals, proper gross/net revenue separation.
- Live authenticated responsive/mobile E2E, tenant/factory isolation end-to-end, large report paging, and staging Netlify preview repair.

**Automated CI** must be verified on newest commit; passing route mapping != completed production UAT.
