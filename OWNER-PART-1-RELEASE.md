# Owner requirements Part 1

## Implemented
- One shared 14-department catalogue in shared/departmentCatalogue.js, consumed by server and client. Fabric, Cutting, Elastic, Accessories, Delivery, Stitching, Inward, Checking, Ironing, Packing, Dispatch, Warehouse, Shop and Marketing.
- Aliases/case normalize at selection boundaries: Despatch, Shope and Stiching map to canonical codes; duplicate/unknown/empty selections reject.
- Company creation shows all departments with selected-plan licensing/limit controls. Backend validates normalized licensed modules and the department cap. Explicit company-form selection is required. Existing trial-approval screens default to the first licensed departments within the Trial limit; an approval request can provide a reviewed selection instead.
- Plan administration uses catalogue checkboxes plus the four existing ERP feature switches. New/saved plans require a department and department limits 1–14. Existing persisted plans are not silently rewritten.
- User department enum and UI use the catalogue; legacy FINISHING records remain readable. Permission choices/validation derive the fourteen department read/write keys. New canonical companies reject user assignment to unselected departments, in addition to existing seat quotas.
- New companies store departmentCatalogueVersion 1. Missing/version 0 companies retain the original downstream compatibility behavior until the owner explicitly reviews/saves selection. Explicit selection updates company and registry in one transaction.
- The existing nine-stage Production & Retail interface remains nine-stage; adding catalogue entries does not create false Fabric/Cutting/Elastic/Accessories/Delivery downstream pages. These continue using their existing modules.

## Existing company migration
Run `node server/scripts/review-department-catalogue.js` with private MONGODB_URI for a dry report. `--apply` additionally requires CATALOGUE_MIGRATION_CONFIRMED=YES and a transaction-capable platform cluster. It only marks missing compatibility versions as 0 in company/registry metadata; no stock, operational collections, purchased limits, live permissions or customer-owned Atlas data are changed. Review old plans/modules/limits before explicitly saving a canonical company selection. The old title-case module fallback is preserved for existing companies; it is not silently converted into a new paid grant.

The script was syntax checked but not run against live MongoDB because no staging credentials are configured. Runtime server startup does not automatically migrate data.

## Validation
122 passed, 0 failed, 4 skipped (126 server tests). Frontend production build passed; application import passed. Added catalogue, alias/duplicate, strict company selection, legacy compatibility and user quota tests. Real database/browser acceptance remains pending.

## Scope boundaries
This part supplies catalogue/selection foundations. Complete role/delegation/location enforcement and all legacy mixed-endpoint access checks are Part 2. Single-department manual external handoffs are Part 4. Paid onboarding/payment pricing is Part 3; this part does not fix the previously reported paid provisioning path. No claims of production acceptance or live migration completion.

Deploy the full repository: both client and server import shared/departmentCatalogue.js. Deploying only the server directory without the shared folder will fail. Existing operating data is retained; new permissions do not by themselves grant a user access.
