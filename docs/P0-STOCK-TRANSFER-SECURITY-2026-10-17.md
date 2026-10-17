# P0 Step 3 — Stock transit, receiver isolation and idempotency

**17 October 2026 · Feature branch only · No live production write.**

## Changes
- Dispatch-only operator can send PACKED stock to active Warehouse; receiving Warehouse independently confirms.
- Warehouse sends to Shop transit; Shop A can send to Shop B transit; assigned receiving Shop B confirms. Source permission must not be confused with destination receipt authority.
- SHOP -> target Master must be active. Disabled Warehouse or Shop locations reject shipment atomically.
- Generic WAREHOUSE dashboard excludes outbound shop transit whose warehouse origin cannot be safely resolved. Warehouse Overview separately uses parent source tracing for assigned warehouses.
- No new stock balance store. Source and destination movements remain in existing transactional ERP journal, ERP bundle and event.
- Existing unique request keys guard idempotent transfers; duplicate retries should never post stock twice.

## QA
- Source/receiver policies tested in `p0StockTransferSafety.test.js`.
- Existing full disposable MongoDB integration test extended for Dispatch-only roles, cross-Warehouse privacy, Shop A -> Shop B -> Warehouse2, disabled destination rejection and repeat-key behavior.
- Live browser, actual user sessions, barcode, over/short delivery, low-stock alert thresholds and legacy Fabric vs ERP ledger reconciliation remain pending.
- Netlify preview remains a separate staging issue.
