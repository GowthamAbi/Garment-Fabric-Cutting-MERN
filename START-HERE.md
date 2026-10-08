> Current department extension: read DEPARTMENT-RELEASE-START-HERE.md after these base setup steps. Current test status is in RELEASE-VALIDATION.md.

# Start here — UG SaaS consolidated ERP

இந்த ZIP-ல் complete client + server source, previous milestones, new ERP modules, tests மற்றும் guides உள்ளன. Live site/GitHub automatic-ஆ மாற்றப்படவில்லை. Fresh folder-ல் extract செய்யுங்கள்; முதலில் staging database பயன்படுத்துங்கள்.

## 1. Server setup — Windows PowerShell

Project folder-ல் terminal open செய்து:

```powershell
cd server
Copy-Item .env.example .env
npm ci
```

`server/.env` edit செய்யுங்கள்: MONGODB_URI = staging Atlas/replica-set URI, JWT_SECRET = private random secret, CLIENT_URL = http://localhost:5173. Standalone MongoDB transactions support செய்யாது. Automation முதலில் false-ஆக இருக்கட்டும்.

```powershell
npm run dev
```

## 2. Client setup — separate terminal

```powershell
cd client
Copy-Item .env.example .env
npm ci
npm run dev
```

Open http://localhost:5173/login. Public showcase: http://localhost:5173/demo. Netlify public root uses the included landing page redirect; local Vite root may show login.

## 3. Owner and customer setup

Fresh database only: server `.env`-ல் OWNER_NAME, OWNER_EMAIL, OWNER_INITIAL_PASSWORD privately set செய்யுங்கள். Long random password பயன்படுத்துங்கள்; name/user ID அடங்கிய weak password reject ஆகும். Server folder-ல் `node scripts/bootstrap-owner.js` run செய்யுங்கள். Fresh bootstrap ID: GOWTHAM2131. Existing owner password reset செய்யாது; shared password ZIP-ல் இல்லை.

Owner console-ல் company create/approve செய்யுங்கள். Customer-க்கு assigned `/c/company-key/login` URL-ல் login செய்யுங்கள். Company admin user IDs and permissions manage செய்வார். Production email verification/reset-க்கு verified sender மற்றும் email provider configuration தேவை.

## 4. ERP opening / cutover

1. Integrated ERP → Masters: customer/vendor, variant/roll SKU, finished SKU, versioned BOM create செய்யுங்கள்.
2. Legacy stock review snapshot download செய்து physical quantities + verified unit costs reconcile செய்யுங்கள். Same stock இரண்டு collections-ல் இருந்தால் double-count செய்யக்கூடாது.
3. OPENING documents post செய்து quantities/value verify செய்யுங்கள். Opening Equity/AR/AP setup-ஐ accounts team review செய்ய வேண்டும்.
4. ERP activate செய்யுங்கள். Old department entry screens read-only ஆகும்; historical data erase ஆகாது. New ERP documents மற்றும் Shop floor screens பயன்படுத்துங்கள்.
5. User Management-ல் ERP grants கொடுங்கள். Permission change பிறகு affected user re-login செய்ய வேண்டும்.

## 5. New production flow

Sales Order → WORK ORDER (BOM) → Shop floor routing → machine/workstation masters → stage assignment/events. Default route: Fabric → Spreading → Cutting → Folding → Stitching → Finishing → Packing; Elastic தேவைப்பட்டால் include செய்யலாம்.

Previous-stage completed quantity-ஐ விட next-stage assignment அதிகமாக முடியாது. Parallel machines/partial quantities supported. START/PAUSE/RESUME/COMPLETE events record செய்யுங்கள். Pause reason + notes record ஆகும். Planned jobs cancel செய்யலாம்; completed event history edit/delete செய்ய முடியாது.

Material Issue + Work Cost ERP documents தனியாக post செய்யுங்கள். Routing events stock move அல்லது labour-cost posting செய்யாது. Packing complete quantity அளவுக்கு மட்டுமே Production Receipt post செய்யலாம். பிறகு QC Release/Reject → Sales Invoice → Dispatch → Receipt. QC release பிறகுதான் finished goods dispatch செய்ய முடியும்.

## 6. Roll QR

ஒரு physical roll-க்கு ஒரு distinct RAW KG SKU வேண்டும். Posted OPENING/GOODS RECEIPT record ID வைத்து Shop floor → Roll QR-ல் register செய்யுங்கள். DC, colour, dia, fabric அடிப்படையில் batch; one DC → one Set No. QR scan login + same company/factory permission கேட்கும். Registered roll SKU-க்கு மற்றொரு roll receipt allowed இல்லை. BOM-ல் actual component roll SKU தேர்வு செய்ய வேண்டும்; automatic interchangeable-roll/FIFO allocation இல்லை.

## 7. Accounts / commercial / approvals

Party master paymentTermDays மற்றும் creditLimit INR configure செய்யலாம்; blank limit = no credit limit. Financial reports, ageing, order cost/margin மற்றும் vendor pending review செய்யுங்கள்.

Two separate company administrators வைத்துப் Approval threshold test செய்யுங்கள். New document → Submit for independent approval. Creator self-approve செய்ய முடியாது. Approved posting இன்னும் stock/link/credit checks pass செய்ய வேண்டும். Only one admin இருந்தால் mandatory dual approval enable செய்யும் முன் second admin setup செய்யுங்கள்.

Bank matching: CSV header `date,reference,amount`; date YYYY-MM-DD; receipt positive INR, payment negative INR. Import accounting entries create செய்யாது. Reviewed document ID match செய்யுங்கள். Wrong match-ஐ reason உடன் unmatch செய்யுங்கள். One BANK ledger/factory மற்றும் unique references மட்டுமே supported.

## 8. HR and maintenance

Workforce: employee records → attendance → reviewed monthly earnings/deductions → payslip print/PDF. Statutory rates/proration automatic இல்லை. Salary expense/payment GL-ல் separately post செய்ய வேண்டும். Correction-க்கு old payslip void செய்து new statement create செய்யுங்கள்; old record retained.

Shop floor → Maintenance: task/due date/machine hold configure செய்யுங்கள். Due blocking task START/RESUME-ஐ தடுக்கிறது. Already running machine-க்கு PAUSE event record செய்யுங்கள். Completion work notes mandatory.

## 9. SaaS automation and licensing

Provider staging tests முடிந்த பிறகுதான் AUTOMATION_ENABLED=true. Configure Resend and Razorpay secrets privately. Subscription settlement user/department entitlement snapshot store செய்கிறது; company-wide limits create/reactivate/change department நேரத்தில் check ஆகும்.

Owner plans modules-ல் explicit tags பயன்படுத்தலாம்: ERP_CORE, ERP_SHOP_FLOOR, ERP_FINANCE, ERP_HR. Explicit tags இருந்தால் ERP_CORE mandatory; selected modules மட்டும் allowed. Department names மட்டும் உள்ள old plans backward compatibility-க்காக all ERP features retain செய்யும். Tag changes paid entitlement snapshot-ல் அடுத்த settlement/renewal பிறகுதான் பிரதிபலிக்கும்; automatic retroactive plan downgrade இல்லை.

## 10. Verify before live upload

`server`: npm test. `client`: npm run build. Real database tests-க்கு TEST_MONGODB_URI privately set செய்யுங்கள். Tests generated databases மட்டும் create/drop செய்யும்; production credentials பயன்படுத்தாதீர்கள்.

RELEASE-VALIDATION.md-ல் உள்ள complete acceptance checklist முடிக்க வேண்டும். Final ZIP என்பது consolidated source package; real provider/database/browser/load/restore verification இல்லாமல் production-certified என்று கருதக்கூடாது.
