# Owner Part 5 — approved production routing and BOM versions

## Implemented
- Immutable route version keys per factory/finished SKU, in production order: Stitching, Inward, Checking, Ironing, Packing, Dispatch. Selected stages must be subscribed and the route must end at Dispatch. Versions can omit QC, Inward, Ironing or Packing explicitly, rather than skipping these through arbitrary stock edits.
- Direct packing/direct dispatch transitions use the approved lot route. Packing consumes its actual material requirements when included. Omitting Packing marks output dispatch-ready without packing-material consumption; PACKED is the existing technical dispatch-ready stage, not proof that omitted packing occurred.
- Route drafts require a company master administrator. Another administrator must approve the draft with APPROVE ROUTE, after reviewing omitted QC/stages and construction. Approval uses the existing factory-scoped idempotent transaction/event flow. The original creator cannot approve their own draft.
- Explicit reviewed externalInput option can authorize external receipt at the route first stage even if the normal upstream is subscribed. Otherwise Part 4 integrated/manual boundaries apply. Route-directed output cannot use an external handover to evade its subscribed next stage (external stitching rework remains an exception governed by the Stitching licence).
- Elastic/strap construction flags identify the reviewed variant. These are descriptive flags: actual consumption remains in the selected BOM and packing master. They do not invent stock or automatically remove materials from a BOM.
- New ERP BOM codes start as DRAFT. Another company master administrator approves with APPROVE BOM. New draft BOMs are rejected by ERP document posting. Existing SKU/BOM definitions still cannot be edited in place; revisions use new codes.
- Route issuance requires an approved matching-SKU BOM if one is specified. Route, construction and BOM components are copied into the production lot. New ERP postings also retain the applied BOM snapshot in document metadata. Later master/version changes do not change these snapshots.
- Department screens include a route/BOM review panel, draft creation, approval controls, optional approved route key on delivery/external receipt, and route/BOM identification on the authenticated bundle trace.
- Routing preserves quantity/value through existing bundle splits and stock transactions. Original DC inward reversal also handles direct-dispatch routes correctly.

## Validation
144 tests: 139 passed, 0 failed, 5 skipped. Frontend production build passed, with the pre-existing large-chunk warning. New policy tests cover direct packing/dispatch, omitted QC, order/duplicate/licence validation, frozen lot transition/actor selection and draft BOM rejection. Anonymous HTTP checks include route creation and route/BOM approval endpoints.
The existing isolated replica-set test now also covers draft self-approval rejection, approval by a different administrator, and an Ironing → Dispatch stock transition. It remains skipped without TEST_MONGODB_URI, along with the other real database acceptance tests. No live logged-in browser/device, physical QR, stock or accountant acceptance was performed.

## How to use
1. Company owner grants a second administrator master permissions; both use the same factory.
2. In ERP Masters, create a new BOM code for the desired variant. A different administrator approves it in Department Workspaces → Approved routing / BOM versions.
3. Create a route draft with a new version key, finished SKU, subscribed ordered stages, optional approved BOM and construction flags. Tick external input only when externally supplied stock at the first stage is intentional.
4. Another administrator reviews and types APPROVE ROUTE. Draft routes cannot be used.
5. Enter the approved route key when issuing Delivery stock to Stitching, or when receiving external goods at that route's first stage. Issue Stitching operation and Packing master versions as applicable. Follow department advance/check/pack/transfer actions; the saved route determines the next ready stage.

## Compatibility / remaining acceptance
Existing lots without a route snapshot retain their legacy routing. Existing BOM contracts without approvalVersion retain prior posting compatibility and are not silently certified; create an approved new code before attaching one to a new approved route. Specialized legacy Fabric/Cutting/BOM screens remain unchanged. Route selection is per finished SKU/lot, not a free-form cyclic workflow designer; warehouse/shop steps continue under Part 4. General approval limits, dual-review rules for other business actions and escalation remain Part 6.
A one-administrator company cannot self-approve a new route/BOM: add a second appropriately authorized administrator. Review omitted QC, variant material quantities and dispatch-ready physical conditions before enabling custom routes. Commercial rollout still requires the skipped database tests and logged-in end-to-end acceptance.
