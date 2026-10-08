<<<<<<< HEAD
# Current release: Production-to-retail extension

Read **DEPARTMENT-RELEASE-START-HERE.md** and **RELEASE-VALIDATION.md** before the older overview below. New department screens, owner licensing, and GST/no-tax configuration are included; staging checks remain mandatory.

# UG SaaS — Integrated ERP release candidate

This consolidated source package includes milestones 1–4, the integrated ERP/automation work and the 7 October manufacturing, commercial and workforce extensions. It is a staging candidate, not a certification of production readiness or feature parity with Zoho, ERPNext or Odoo. Start with START-HERE.md, FINAL-ERP-SCOPE.md and RELEASE-VALIDATION.md. Older milestone documents describe historical work; these current documents take precedence.
=======
# Garment Production Flow SaaS — Full MERN Source

Readable MVC-style MERN project with separate `client` and `server` folders. It
merges Fabric, Cutting, Elastic, Accessories and garment delivery traceability
under one multi-company SaaS login.
>>>>>>> 50a2d22da23f6913de1a4c7a8fddee39543e5810

## Role layout

<<<<<<< HEAD
- Explicit company database and factory scopes, user-ID login, strong passwords, reset flow, role/grant controls and company-approved support access.
- Variant SKUs, customer/supplier masters, versioned BOMs and reviewed opening balances.
- Purchase order → goods receipt → purchase invoice → payment.
- Quotation → sales order → sales invoice → QC-approved dispatch → receipt.
- Work order → material issue/return → labour/other work costs → partial production receipts → QC release/rejection.
- Department stock transfers, same-item jobwork, waste, sales/purchase returns and dependency-aware reversals.
- Transactional stock/journal/document posting with idempotent retries, integer monetary calculations, weighted-average valuation and work-order-specific WIP.
- Trial balance, profit/loss, balance sheet, party outstanding, stock/control-account reconciliation and individual bank transaction matching.
- Printable ERP documents with company/party billing snapshots; subscription invoices and queued invoice emails.
- Signed payment capture inbox, expiry/reminder jobs, cancellation and owner-approved full refunds, bounded retry/dead-letter monitoring.
- Encrypted tenant backup export/validation/empty-database restore tools.
- Work-order department routes, quantity-gated Cutting/Folding/Packing completion, machine assignments, overlap/active-machine protection, event timing, Gantt/weekly reports and maintenance holds.
- Secure physical-roll QR tied to a distinct ledger SKU, fiscal-year batch/one-DC-one-set rules and receipt/stock trace.
- BOM material shortage suggestions, actual work-order costing, sales-order margin indicators, vendor pending quantities, due-date ageing and customer credit limits.
- Independent approval queue, immutable approved proposals, threshold enforcement and atomic approval/ledger posting.
- Signed-amount bank CSV import and reviewed match/unmatch, employee/attendance records and immutable reviewed payslips.
- Concurrent user/department quota enforcement, entitlement snapshots and explicit ERP feature tags for plan gating.
=======
- `saas_super_admin`: companies, subscriptions and SaaS control.
- `company_admin`: department dashboard, Reports, Timeline, Stock, Approvals,
  Item/Fabric/Process Masters, users and Subscription menu. Operational entry
  is blocked by the backend.
- `department_incharge`: assigned department monitoring, history, timeline,
  status, stock, reports and approvals.
- `department_entry`: assigned department entry and print workflow only.
- Existing Store and Production roles remain compatible.
>>>>>>> 50a2d22da23f6913de1a4c7a8fddee39543e5810

Creating a new department account never replaces existing data. It reads the
same company/factory/department history and appends new audited records.

## Fabric to cutting workflow

1. Fabric Master stores only Fabric Code, Fabric Name and Fabric Group. Item,
   Sample, Company Name and Company Type fields are intentionally excluded.
2. Compacting and Dyeing use a separate Code → Name Process Master.
3. Common Item Master stores Item Code/Name, Fabric Group, and mandatory
   size-wise Dia, cutting/folding weight, elastic measurement/ranges and
   per-piece accessories.
4. Fabric Inward generates an inward number and records DC No, Lot DC No,
   Compacting/Dyeing and multiple colours with Dia-wise Sample Rolls/KG and Lot
   Rolls/KG. Reference Name, Supplier and Item Name are excluded.
5. Every roll receives a unique QR containing Inward No, Sample/Lot, Fabric
   Group, Roll No, average weight, Colour, Dyeing and Compacting names.
6. Production Plan reads the approved Item Master by Item Code. The operator
   enters Size + PCS; Dia is resolved automatically from Item Master. Fresh Lot uses
   cutting weight; Folding Lot uses cutting + folding weight. It divides PCS
   evenly and automatically reallocates from a low-stock colour to other
   selected colours. Every reservation checks the exact Fabric Group + Colour +
   Dia stock. Insufficient matching stock blocks saving.
   Plan No is an automatic four-digit tenant sequence. Saving reserves the
   required colour stock, while edit/delete recalculates or releases that
   reservation. Once fabric is physically issued, edit/delete is blocked.
7. Fabric Issue consumes the scanned inward and colour through FIFO roll stock.
8. Cutting Actual uses one consolidated row per colour and dynamic size
   columns. Actual KG is calculated from Actual PCS × item piece weight. Bundle
   count/weight are entered, and Actual KG minus Bundle KG is saved by
   Plan/DC/Colour/Size in Fabric Waste Warehouse. Negative waste is blocked.
9. Elastic Requirement reads actual cutting PCS and approved size-wise elastic
   measurement, then produces a professional printable/CSV/PDF wanted-MTR sheet.

An inward whose roll stock has already been issued cannot be edited; use an
adjustment entry so historic stock and audit traceability remain correct.

The old Garment Flow sidebar and pages are removed. Underlying historical
traceability collections remain because Fabric/Cutting/Elastic data references
them. Fabric receipt and roll labels use dedicated A4 layouts with Print and PDF
download, plus date-range/DC/fabric/type filters. Production Plan has separate
Data Entry and professional A4 Print/PDF pages. Fabric and Cutting roles also
have department-scoped History and Print pages.

The Cutting sidebar groups Production Plan into Data Entry, Print and History.
The print sheet shows a consolidated Colour/PCS/KG summary, a Size/Dia/PCS/KG
summary, and a Size/Dia/Colour detail table. It supports multi-page A4 output
and excludes internal available-stock figures. Fabric Stock is Dia-wise and
shows Gross, Reserved and Available KG with Excel, Print and PDF.

## Elastic Cutting DC workflow

- Cutting DC No and Store Outward DC No use the same common number.
- Item Name + Style + Size measurement is saved in Measurement Master and auto-filled next time.
- Colour-wise PCS and measurement calculate wanted MTR automatically (maximum 10 size lines).
- Material is validated against colour-wise Store Outward. Shortage can use Balance Elastic or create a No Stock request for Store.
- Main DC scanning in Production loads saved colour/size/PCS automatically.
- Completion sends OK, rework and rejection PCS to their warehouses. Extra picked elastic is saved automatically as DC + Colour + Remaining MTR in Balance Elastic Warehouse.
- Cutting DC can be viewed by DC number, printed, or downloaded as a landscape PDF.

## SaaS security and operations

- Role enforcement: SaaS Super Admin, Company Admin/Admin, Store and Production-related users.
- Company and factory isolation is applied automatically to MongoDB reads, writes and aggregations.
- Active-subscription middleware blocks expired/suspended companies while allowing subscription renewal.
- Manual subscription approval and Razorpay order/webhook support are included.
- Every authenticated create/update/delete request produces an audit record without passwords or reset tokens.
- Company administrators can filter audit history and download a company-scoped JSON backup.
- Login throttling, BCrypt password hashing, expiring JWT, password reset expiry, CORS allow-list, security headers and production HSTS are enabled.
- QR camera permission is limited by browser security policy; production scan links open a standalone screen without sidebar navigation.
- Mobile layouts, English/Tamil selector, privacy policy and an eight-step onboarding guide are included.

## Login and role setup

1. With a fresh MongoDB database, open the website. The API detects that no user exists and opens **First-time SaaS Owner Setup** automatically.
2. Register once. This first account is stored with role `saas_super_admin` and opens the dedicated SaaS Owner Dashboard.
3. The SaaS Owner creates companies. Opening a company card shows its factory, subscription and department-wise users.
4. The Owner creates a `company_admin` for each customer company. Company Admin creates Store and Production users from User Management.
5. Every role uses the same Login page. The server reads the role from the authenticated database account and opens only the permitted layout:
   - `saas_super_admin` → SaaS Owner Console
   - `company_admin` / `admin` → Company module selector and administration
   - `fabric_admin` / `fabric_entry` → Fabric master and inward operations
   - `cutting_admin` / `cutting_entry` → Fabric issue and cutting actual
   - `elastic_admin` / `elastic_entry` → Elastic requirements and operations
   - `accessories_admin` / `accessories_entry` → Accessories operations
   - `store` → Store dashboard, PO, inward, outward, stock and print
   - `production` and production roles → Production dashboard, machines, Cutting DC, warehouses and sewing delivery
6. Forgot Password also uses the same registered email. In production, configure `RESEND_API_KEY` and `EMAIL_FROM` to deliver the reset link.

Do not create separate public login URLs for each role. One login form plus server-side role enforcement prevents users from selecting or changing their own role.

<<<<<<< HEAD
This release does not include statutory GST filing/e-invoicing, automatic payroll tax/PF/ESI computation, an automatic capacity optimizer, interchangeable-roll BOM substitution/FIFO picking, multicurrency, a configurable chart of accounts, automatic bank feeds or automatic charge mandates. Payroll figures require manual professional review and separate GL/payment posting. Roll tracking requires a distinct SKU per physical roll. Existing roll/machine forms are historical/legacy after cutover; use the new Shop floor and ERP document screens. INR tax entries require accountant review. Post-sale support, data retention duration and backup policy need contractual definition. See FINAL-ERP-SCOPE.md for exact implementation boundaries.
=======
### Production environment variables

Set `MONGODB_URI`, a long random `JWT_SECRET`, exact HTTPS `CLIENT_URL`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RESEND_API_KEY`, and `EMAIL_FROM` on Render. Never commit real secrets. Configure the Razorpay webhook URL as `/api/webhooks/razorpay`. Netlify and Render must both use HTTPS.

## UG SaaS commercial console

- Public showcase and pricing page: `/demo` (also available at `/pricing` and `/try-demo`).
- Trial registration creates an isolated customer company and company-admin login. Access is automatically blocked when the configured Trial validity expires.
- Owner-managed plans: Trial, Starter, Professional, Business, Enterprise, and Setup & Training. Price, internal cost, setup fee, tax, validity, users, departments, and modules can be edited without code changes.
- Two payment methods are supported:
  - **Manual Payment** creates a pending transaction. Only the SaaS Owner can approve it and activate the subscription.
  - **Razorpay** creates an order and activates the subscription only after server-side signature verification or a verified webhook.
- Owner analytics include companies, active users, trials, new requests, revenue, estimated profit, pending payments, plan performance, and renewal alerts.
- Lead CRM records calls, emails, WhatsApp, visits, requirements, customisations, remarks, follow-up dates, and conversion status.
- Subscription controls support activation, pause, revoke, and archive from Company Management.

For Razorpay, create a webhook for `payment.captured` at `https://YOUR-RENDER-URL/api/webhooks/razorpay`. Keep `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` on the server only.

### Backup responsibility

The in-app export creates a tenant-scoped portable backup. For disaster recovery, also enable MongoDB Atlas automated backups and periodically test restore in a separate database. Do not store backup JSON in a public folder.

## SaaS production workflow

- Company + factory tenant isolation with audit fields.
- SaaS Super Admin, Company Admin, Store, Planner, Operator, Supervisor,
  Quality, Maintenance, Sewing Coordinator, Management and View Only roles.
- Vendor, Section, Colour, Size and Sewing Unit masters.
- DC-based plans with multiple colours and sizes.
- Main DC QR + colour QR, machine QR and employee QR production control.
- Complete, breakdown, thread/box/size/other-change time tracking.
- OK, rework, rejection, balance, material pending and sewing hold flows.
- Sewing split delivery, dashboard, combined reports, CSV/PDF/print and trace search.
- DC print keeps the Main DC QR at the top centre and one exact row QR for each
  Outward No. + Inward No. + Colour combination.
- Public QR outward saves company/factory ownership and repairs legacy records
  that previously caused a DC print 404.
- Inward lots retain brand, description, type, colour and unit for traceability.
- Mobile outward completion shows a confirmation popup and next-inward scan entry.
- Slash-safe Item + Colour lookup supports item codes such as `RR/30`.
- Admin login opens a Store / Production workspace selector.
- DC PDF is a professional single-page A4 landscape document. Outward and
  Inward numbers stay in the screen view and inside each row QR; the printed
  table shows only S.No, Description, Item Code, Colour, QR and Quantity.

The first registration creates the initial company, factory and SaaS Super Admin.
Existing single-company data is attached to a default company during startup.

## Folder structure

```
Store/
├── client/                 React + Vite frontend
│   └── src/
│       ├── components/     Reusable UI components
│       ├── api.js          Backend API helper
│       ├── App.jsx         Pages and business flow
│       └── styles.css      Complete responsive styling
└── server/                 Node + Express backend
    └── src/
        ├── models/         MongoDB/Mongoose schemas
        ├── routes/         REST API routes
        ├── utils/          Shared helpers
        └── server.js       Server entry point
```

## Run locally

1. Create a MongoDB Atlas database.
2. Copy `server/.env.example` to `server/.env` and add your MongoDB URI.
3. Copy `client/.env.example` to `client/.env`.
4. From the root folder run:

```bash
npm install
npm run install:all
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:5000`

## Deploy

- Render root directory: `server`; build `npm install`; start `npm start`.
- Netlify base directory: `client`; build `npm run build`; publish `dist`.
- Set `VITE_API_URL=https://YOUR-RENDER-URL/api` in Netlify.
- Set `MONGODB_URI`, `CLIENT_URL` and `JWT_SECRET` in Render.

## Main features

- Master item Add, Edit, Delete
- Purchase order Add, Edit, Delete and pending balance
- Multi-row inward receipt with unique inward number
- Outward issue subtracts the exact inward balance
- Live stock summary
- Minimum quantity and PO delivery alerts
- Date/category transaction history
- CSV export
- Login and registration using JWT

## Elastic Production SaaS extension

- The first registered account is the single company administrator.
- Existing installations automatically promote the oldest account when no admin exists.
- Admin creates separate Store and Production users from User Management.
- All colour outwards sharing one DC No. are combined in the DC generator.
- The DC print/PDF creates one Main DC QR plus one QR for every unique colour.
- Main DC, Colour, Machine and Employee QR scans are retained as one production draft.
- Production runs track colour, size, planned/OK/rework/rejection/balance pieces.
- Machine stops track Complete, Breakdown, Thread, Box, Size and Other changes.
- Section Pending tracks shortage, elastic rejection, production/rework/sewing holds and material requests.
- Sewing Delivery splits available OK pieces by sewing unit and delivery person.

For password-reset email, configure `RESEND_API_KEY`, `EMAIL_FROM`, and deployed
`CLIENT_URL` in Render. Reset links expire after 30 minutes.
>>>>>>> 50a2d22da23f6913de1a4c7a8fddee39543e5810
