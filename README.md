# Garment Fabric Cutting MERN

Standalone readable React + Node + Express + MongoDB project. Accessories is intentionally excluded and can be merged after this workflow is tested.

## Flow

`PO and BOM → Fabric inward → Bundle QR → 4-digit fabric outward → Priority/FIFO allocation → Cutting queue → Spreader → Cutter → Cutting actual → Folding fabric requirement`

## Main features

- PO delivery-date data and item/colour/size quantities.
- Item BOM with size-wise cutting and folding KG per piece.
- Fabric master with group, type, colour, dia and GSM.
- Total-only, exact bundle-wise or hybrid inward entry.
- Individual immutable QR token for every fabric bundle.
- Sample rolls remain linked to the same inward lot.
- Four-digit company/factory-specific outward DC sequence starts at 1000.
- Colour/size wanted weight and priority + FIFO stock allocation.
- Cutting queue ordered by priority and required delivery date.
- Spreader and cutter machine QR, one active DC per machine, stop/resume events.
- 24-hour or 7-day machine timeline API.
- Cutting actual pieces, bundle weight, return, waste and waste percentage.
- Folding requirement generated from actual cut pieces, not planned pieces.
- Global API loading overlay, errors and CSV Excel-compatible downloads.

## Run

```bash
npm install
npm run install:all
```

Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env`, then:

```bash
npm run dev
```

Client: `http://localhost:5173`  
Server: `http://localhost:5000/api/health`

## Deployment

- Netlify: base `client`, build `npm run build`, publish `dist`.
- Render: root `server`, build `npm install`, start `npm start`.
- Set exact deployed client URL in server `CLIENT_URL`.
- This standalone module uses company/factory request headers. During the Accessories merge, replace this middleware with the existing JWT tenant context and role permissions.

## Important production note

The allocation endpoint demonstrates the confirmed logic. During merge, wrap allocation creation and bundle deductions in a MongoDB transaction so simultaneous QR scans cannot consume the same weight.
## Controlled BOM and Excel PO workflow

- Garment BOM numbers are generated as `BOM-0001`, `BOM-0002`.
- Size modal stores Dia, Cutting WT/PCS, Folding WT/PCS and calculated Total WT/PCS.
- An approved BOM is never overwritten. Editing creates a pending revision; Admin approval activates it.
- Purchase Order Excel import reads `Sheet1` and maps Item Group from `COLOUR`.
- Duplicate PO keys wait for Admin **Replace / Add / Reject** approval with full batch audit.
- Delivery date range displays Order, Actual Cutting Completed and Cutting Pending quantities.
