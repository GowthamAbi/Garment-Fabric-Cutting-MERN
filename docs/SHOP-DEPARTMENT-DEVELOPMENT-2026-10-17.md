# UG SaaS SHOP Department — Development 17 October 2026

**Book1.xlsx Shop:** 21 options, **10 Head F351–F360 and 11 Staff F363–F373**.  
**Existing branch:** `feature/department-role-sidebar-foundation-20261015` · draft PR #1.  
**Status:** feature batch implemented; full mobile/live UAT, production rollout and cross-department acceptance **NOT** complete. `main` unchanged.

## Actual development
- New tenant/factory/shop-assignment scoped `GET /api/erp/departments/shop-overview` reads authoritative posted `RetailSale`, `ErpDocument` COGS journals, `DepartmentEvent` returns and transfers, and current Shop / Transit bundles. Per-shop live PCS, invoice count, Cash/Bank paid receipts, gross/net after posted refunds, net COGS margin, posted refund totals, Warehouse → Shop transit receipt history, bundle/stock trace and return review requests. No independent stock/revenue balances; hard 10k-record limits fail closed.
- **Margin:** Actual net sales after posted returns minus original posted COGS net of returned COGS, in integer paise. If COGS document absent, margin is unavailable, not guessed.
- Staff Online POS `POST /erp/departments/sale` uses original MongoDB transaction for stock deduction, paid Cash or Bank and invoice, plus existing offline cash-sale draft/sync with provisional receipt warnings. Separate credit invoice, payment advances, instalments, gateway collections remain pending.
- Warehouse-bound Shop stock: existing `POST /transfer` `TRANSIT_SHOP → SHOP` confirms Shop physical receipt; `SHOP → TRANSIT_WAREHOUSE/TRANSIT_SHOP` sends to destination for separate receipt. Forms preserve idempotency keys.
- Staff sales return **review request**, `POST /shop-return-requests`, checks live invoice/Shop access, unreturned whole-PCS, category and reason, idempotent retries. This **does not refund or restock goods**. Existing ERP `POST /return` is the posting workflow and moves returned pieces to Checking. Independent return approval and request→posting linkage remain pending; no deceptive auto-approval.
- Shop Stock Count uses existing `POST /stock-exceptions` non-posting request; only independent authorized Company Admin decision posts shortage/damage adjustment. No Head approval bypass.
- Posted sales invoices and invoice-print view with saved company/customer/payment/tax data, search, Excel-compatible export, browser print. Statutory GST invoice fields/formats must be independently reviewed.

## Excel option coverage
| Excel | Role | Screen |
|---|---|---|
| F351/F363 | Head/Staff | Shared department dashboard |
| F352 | Head | Shop Sales Overview |
| F353 | Head | Sales Margin (posted COGS/refunds) |
| F354/F364 | Head/Staff | Shop Stock |
| F355 | Head | Warehouse Transfer Status |
| F356 | Head | Sales Returns / Discounts |
| F357 | Head | Pending Stock Issues (live stock + approval explanation; dedicated adjustment queue pending) |
| F358/F359 | Head | Shared approval inbox/tasks; customer return integration pending |
| F360/F373 | Head/Staff | Shop Reports/History |
| F365 | Staff | Online POS / Sales Entry, existing offline drafts |
| F366 | Staff | Customer Sales Invoice |
| F367 | Staff | Immediate Cash/Bank Payment Collection view |
| F368 | Staff | Warehouse Stock Receipt |
| F369 | Staff | Shop Stock Transfer |
| F370 | Staff | Non-posting Sales Return Request |
| F371 | Staff | Shop Stock Count / Adjustment Request |
| F372 | Staff | Posted Invoice Print |

## Remaining production work
- Refund request approval, independent physical goods receipt, exact invoice linkage and posted refund processing, prevention of multiple concurrent pending requests, cancellation handling.
- Credit receivables, payment settlement/reconciliation, payment gateway, split tender and advances; current paid Cash/Bank only.
- GST compliance review, tax invoices, fiscal numbering, discount calculation, customer tax details; browser print not a statutory-compliance guarantee.
- Shop → Warehouse/Shop outbound stock transfer full end-to-end with assigned location authorization and retail terminal UAT, offline sync on real phones, RBAC tenant/factory/shop isolation.
- Stock count exception decision display, serialized inventory/QR labels, mobile responsive QA, high-volume/pagination.
- Netlify preview deployment repair (independent of passed GitHub CI), staging user acceptance and general production readiness.

**Verification:** tests added for 21 workbook routes, policy totals, posted COGS/refunds, receipt status and role isolation. Observe latest GitHub Actions before claiming green.
