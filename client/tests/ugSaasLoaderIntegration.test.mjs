import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const component = source("../src/components/common/UGSaaSLoader.jsx");
const css = source("../src/components/common/ugSaasLoader.css");
const feedback = source("../src/components/common/GlobalFeedback.jsx");
const app = source("../src/App.jsx");
const protectedRoute = source("../src/routes/ProtectedRoute.jsx");
const inline = source("../src/components/common/Loader.jsx");
const otherOverlay = source("../src/components/common/GlobalLoader.jsx");

test("UG SaaS garment logo and branded animation live in a shared component",()=>{
 assert.match(component,/UG SaaS/);
 assert.match(component,/Garment ERP Solutions/);
 assert.match(component,/ug-loader__machine/);
 assert.match(component,/ug-loader__orbit--gold/);
 assert.match(component,/ug-loader__orbit--teal/);
 assert.match(component,/ug-loader__track/);
 assert.match(component,/import "\.\/ugSaasLoader\.css"/);
 assert.doesNotMatch(component,/Math\.random|setInterval|100%|progress\s*=|navigator\.clipboard/);
});

test("Real request completion controls overlay, not a fabricated progress timer",()=>{
 assert.match(feedback,/pending > 0/);
 assert.match(feedback,/accessories-api-start/);
 assert.match(feedback,/accessories-api-end/);
 assert.match(feedback,/setShowLoader\(true\)/);
 assert.match(feedback,/setShowLoader\(false\)/);
 assert.match(feedback,/window\.clearTimeout\(id\)/);
 assert.match(feedback,/UGSaaSLoader/);
 assert.doesNotMatch(feedback,/LoaderCircle/);
});

test("Auth and generic component loaders now use one consistent UG SaaS design",()=>{
 assert.match(app,/ug-session-loading/);
 assert.match(app,/UGSaaSLoader message="Verifying your secure session/);
 assert.match(protectedRoute,/UGSaaSLoader/);
 assert.match(inline,/surface="transparent"/);
 assert.match(otherOverlay,/UGSaaSLoader/);
});

test("Full-screen theme, mobile and reduced-motion are supported",()=>{
 assert.match(css,/html\[data-theme="dark"\]/);
 assert.match(css,/html:not\(\[data-theme="dark"\]\)/);
 assert.match(css,/@media \(max-width: 480px\)/);
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
 assert.match(css,/\.ug-global-loader-backdrop/);
 assert.match(css,/@media print/);
 assert.match(component,/role="status"/);
 assert.match(component,/aria-live="polite"/);
 assert.match(component,/aria-hidden="true"/);
});

test("New loader is styling-isolated from deprecated global spinner selectors",()=>{
 assert.doesNotMatch(feedback,/className="global-loading-overlay"/);
 assert.match(feedback,/className="ug-global-loader-backdrop"/);
 assert.doesNotMatch(inline,/className="loading"/);
});
