import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const file=(relative)=>readFileSync(fileURLToPath(new URL(relative,import.meta.url)),"utf8");
const entry=file("../src/main.jsx");
const css=file("../src/styles/professional-workspace.css");
const layout=file("../src/components/layout/MainLayout.jsx");

test("professional styles load after existing themes and department-specific styles",()=>{
 const index=entry.indexOf("styles/professional-workspace.css");
 assert.ok(index>entry.indexOf("styles/company-console.css"));
 assert.ok(index>entry.indexOf("styles/theme-toggle.css"));
});
test("workspace layout correction applies only on-screen and preserves print styling",()=>{
 assert.match(css,/@media screen\s*\{/);
 assert.doesNotMatch(css,/@media print\b/);
 assert.match(css,/\.app-shell \.page/);
 assert.match(css,/\.owner-shell \.page/);
 assert.match(css,/\.erp-table/);
});
test("small viewport, dark theme, keyboard focus and reduced motion remain covered",()=>{
 assert.match(css,/max-width:\s*760px/);
 assert.match(css,/max-width:\s*390px/);
 assert.match(css,/html\[data-theme="dark"\]/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/prefers-reduced-motion:\s*reduce/);
});
test("Head and Staff nav uses exact authorized pages with active semantic state",()=>{
 assert.match(layout,/roleDepartmentPages\(user,access\)\.map/);
 assert.match(layout,/role-workspace-nav/);
 assert.match(layout,/aria-current=\{page===item\.page\?"page":undefined\}/);
});
