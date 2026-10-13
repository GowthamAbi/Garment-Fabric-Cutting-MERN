# Any-department selection and Own Plan

- All 14 department choices remain selectable during company creation. Selections outside a preset licence/capacity switch to the active Own Plan. If unavailable, a precise configure-plan message is shown rather than silently granting access.
- A missing OWN_PLAN catalogue entry is seeded with all 14 departments, ERP_CORE, 14 department capacity and per-department pricing. Initial rate is zero: checkout deliberately rejects it until the owner configures a positive rate.
- Plans & Pricing includes Configure Own Plan; use it to edit rates, tax, duration, user limits and ERP features. Department checkbox edits update maximum-department capacity to match selected coverage; this can subsequently be edited deliberately.
- Subscription Purchase shows Own Plan and the per-department rate, lets the customer select licensed departments and requests a server-revalidated quote. Captured payment/manual approved settlement is still required for entitlements. No free bypass was introduced.
- Existing customer subscriptions and owner-edited presets are not automatically expanded. Existing Own Plan configuration is not overwritten by seeding; use Configure Own Plan to restore full selection if required.
- Removed System theme; Sun/Moon only. Previous system preference falls back to Light. Profile and theme controls are aligned in the header with mobile wrapping.

Verification: 155 server tests passed, 0 failed, 7 database tests skipped; frontend build and layout render smoke checks passed. Added all-14 Own Plan quote and zero-price rejection checks. Live checkout, browser alignment on every page and physical-device acceptance remain pending.
