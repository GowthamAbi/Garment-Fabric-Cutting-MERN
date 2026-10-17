# UG SaaS branded animated garment loader (17 October 2026)

## Requirement
Replace the old generic spinners with a premium sewing-machine + hanger + textile wave animation and dual counter-rotating gold/teal rings, based on the supplied React/Tailwind mock-up.

## Integrated (no new Tailwind dependency)
- New reusable `client/src/components/common/UGSaaSLoader.jsx` with isolated `ugSaasLoader.css`. SVG sewing machine, circular rings, subtle glow, status label and indeterminate progress.
- `GlobalFeedback` API overlay uses the branded loader after a short **180 ms delay** to avoid flashes for fast requests; real request-start/end events manage show/hide and concurrent requests.
- Session loading in `App.jsx` and `ProtectedRoute.jsx` uses the same branded loader. `Loader.jsx` and compatibility `GlobalLoader.jsx` use the same design.
- Uses existing `html[data-theme=dark]` signal automatically. Light mode: ivory, emerald and gold; dark mode: navy, teal and gold. Mobile compacts the rings and text.
- CSS `prefers-reduced-motion: reduce` disables rotation, aura and progress motion; accessible status role.
- **No simulated completion %**; indeterminate progress accurately reflects unknown network duration. Logo is purely decorative for assistive technologies.
- Modal control panel, copy buttons, speed presets and manual slider from provided *demo* code are preview controls, deliberately **not** shipped in the production loading overlay.
- No production deploy; feature branch only. Old spinner styles remain inert for compatibility with other views until further CSS cleanup.

## Test / acceptance
- `client/tests/ugSaasLoaderIntegration.test.mjs` asserts branding, loading lifecycle, session integration, responsive theme, reduced motion and accessibility.
- Run client build + server tests in existing GitHub Actions. **Passing CI does not guarantee browser/device pixel acceptance.**
- QA still needs logged-in browser/light/dark screenshots, slow/fast API response timings, touch/multiple fetch, errors, reduced-motion device test.
- Existing Netlify preview build/deploy failure is separately tracked; don't treat this UI batch as deployed.
