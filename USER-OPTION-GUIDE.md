# UG SaaS option-by-option operating guide

Sign in using the company URL, user ID and password. Email is used for activation/recovery. Select only assigned factory/shop scope. Missing options can mean role, department, subscription or ERP activation restrictions. Contact your company administrator; do not use another company's ID.

| Option | Input / prerequisite | Action and result |
| --- | --- | --- |
| Companies / Create company | Unique company key, administrator email, licensed departments and plan | Create; inspect the saved company, admin ID, assigned departments and activation status |
| Activation / Resend | Configured verified sender and correct administrator email | Send activation link; check displayed delivery error/status; recipient verifies before login |
| User Management | Company/factory, department, role, unique user ID, strong password | Save assigned permissions; user can access only permitted operations |
| Forgot Password | Registered email in the correct workspace | Request one-use reset link; reset does not replace email activation |
| Subscription / Upgrade | Plan features, user limits, duration, tax profile | Pay through configured checkout; access changes only after confirmed payment capture |
| Bills / Invoice | Confirmed subscription payment | Review date, invoice number, amounts and GST/non-GST profile before download |
| Item / SKU Master | Variant, colour, size, unit and classification | Create consistent identifiers before purchasing or stock posting |
| Fabric / Vendor Master | Supplier, fabric group/code, units | Save reviewed masters; do not change units to disguise stock differences |
| Fabric Inward | PO/vendor/roll/lot and actual received quantity | Receive into reviewed stock; label/print the correct roll QR |
| Production / Folding Plan | Approved fabric order and variant requirements | Save planned consumption; complete required folding entries |
| Cutting Actual | Plan, machine/operator/shift, actual quantity/waste | Complete cutting; review physical output and piece-stock handoff prerequisites |
| Delivery Challan / Stitching handoff | Issued line, correct variant SKU, operation/packing masters | Link partial/full pieces once; remaining balance must not become negative |
| Stitching Master | Item operations in their actual order | Save reusable operations before starting a lot |
| Stitching / Advance | Bundle, operation, operator/shift, pieces | Move only available pieces; inspect operation WIP and output dashboard |
| Inward | Stitched bundle/DC and actual received pieces | Partial inward reduces pending section stock, not the original sent total |
| Checking | Available pieces split into good/rework/oil/reject | Good goes forward; rework/oil cycle back to checking; rejects go to waste |
| Bundle QR / Trace | Authorized bundle | Open stage/history; print and attach the correct bundle tag |
| Ironing | Good bundle and quantity | Advance ironed pieces to packing |
| Packing Master | Variant and material rows/quantity per pieces | Define polybag/card/pin/label/tag and other required accessories |
| Packing | Bundle, available materials and packed pieces | Consume reviewed accessory quantities and prepare cartons |
| Dispatch / Transfer | Packed quantity and correct destination | Create transit movement; destination receipt is a separate step |
| Warehouse / Receive | Actual delivered quantity and destination | Receive physical stock; investigate transit differences |
| Rack / Bin | Warehouse and unique location identifiers | Create location; relocate received pieces within the correct warehouse |
| Stock Count / Exception | Bundle snapshot, counted good pieces and reason | Request missing/damaged exception; different administrator decides; changed stock requires recount |
| Shop Allocation / Receive | Warehouse stock, shop and quantity | Transfer/receive into the assigned shop; maintain variant stock |
| Retail Sale | Shop bundle, quantity, price, discount, tax and customer details | Post final sale/invoice only after server stock validation |
| Return / Refund | Original sale, unreturned quantity and reason | Post linked refund/stock return; returned pieces go to checking |
| Offline POS / Enroll | Online authorized shop user, current catalog, device passphrase | Prepare limited offline catalog; open the offline page before disconnecting |
| Offline Draft / Receipt | Unexpired unlocked catalog and available last-known pieces | Save provisional cash record; receipt is not a final GST invoice |
| Sync / Retry | Original company/factory/user login and network | Retry original keys; review stock conflicts; never recreate an uncertain sale with a new key |
| Marketing Analysis | Window, lead days, buffer, reviewed season/promotion/stockout inputs | Review replenishment suggestion; it does not automatically reserve stock or create an order |
| WIP / Targets | Operation, SKU, date, operator/shift | Save targets; compare actual output, aging and inspection-attempt defects |
| Labour / Jobwork Cost | Reviewed bill-line reference, lot, amount and supplier/payment account | Allocate before sale/loss; reference duplicates are rejected; avoid booking the same bill elsewhere |
| Employees / Attendance | Employee code and reviewed daily attendance | Create staff record and present/absent/leave/half-day history |
| Payroll Rules / Preview | Reviewed rates, caps, effective period and wage basis | Create immutable rule version; preview before saving a payslip |
| Payslip / Accrual | Approved month and amounts | Save statement; post salary expense/liabilities separately from payment |
| Statutory Review / Export | Rule-based payslips with active accruals | Export reviewed contributions; not an official government filing |
| Statutory Reference Decision | Different administrator, matching pack, portal/bank evidence | Record external filing/payment evidence or reject; no automatic bank transfer |
| Reverse / Void | Source document, allowed sequence and correction reason | Reverse linked accounting before voiding; retain audit history |
| Reports / History / Timeline | Correct scope and date filters | Review source records and pending/WIP/stock/accounts before export |
| Approvals | Requested exception and independent review | Approve only permitted requests; use a reason and inspect any snapshot change |
| Customer Database | Private customer-owned Atlas connection in the secured form | Validate first; transfer after trial eligibility with maintenance/recovery checks |
| Support Access | Customer-approved scopes and expiry | Grant/revoke limited owner support; owner role does not grant unrestricted operational access |
| Audit / Backup | Authorized scope and protected destination | Review immutable evidence, export and execute isolated restore drill |
| Light / Dark / System | Display theme control in header | Apply preferred screen appearance; print remains light |
| How to use | Current page | Open its workflow guide; keyboard focus stays inside dialog; Escape/Close returns to page |
| Logout / Idle Lock | Active session | Close private UI; fresh login required after logout or 30-minute inactivity |

For unlisted module-specific fields, use the page's labels and validation errors plus the applicable workflow above. A guide explains operation; it does not grant permission or certify tax/legal correctness.
