import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {portalSectionForUser,sidebarSectionAllowed,pageAllowedForPortal,visiblePageForUser,
 showExtraNavigation} from "../src/config/portalNavigationPolicy.mjs";
const file=p=>readFileSync(new URL(p,import.meta.url),"utf8");
test("P0: company admin and company owner only see company console",()=>{
 for(const u of [{role:"company_admin"},{role:"company_owner"}]){
  assert.equal(portalSectionForUser(u),"COMPANY_ADMIN");
  for(const dept of ["FABRIC","CUTTING","DELIVERY","ADMIN","ELASTIC","WAREHOUSE","SHOP"])
   assert.equal(sidebarSectionAllowed(u,dept),false);
  assert.equal(sidebarSectionAllowed(u,"COMPANY_ADMIN"),true);
  assert.equal(showExtraNavigation(u),false);
  assert.equal(pageAllowedForPortal(u,"Department Workspace:FABRIC"),false);
  assert.equal(visiblePageForUser(u,"Fabric Dashboard"),"Company Dashboard");
  assert.equal(pageAllowedForPortal(u,"Company Approval Settings"),true);
  assert.equal(pageAllowedForPortal(u,"Approval Authority"),true);
 }
});
test("P0: factory admin sees own portal only",()=>{
 const u={role:"admin"};
 assert.equal(sidebarSectionAllowed(u,"ADMIN"),true);
 assert.equal(sidebarSectionAllowed(u,"COMPANY_ADMIN"),false);
 assert.equal(pageAllowedForPortal(u,"Admin Dashboard"),true);
 assert.equal(pageAllowedForPortal(u,"Company Dashboard"),false);
});
test("P0: department staff keeps approved Excel and approval/task screens",()=>{
 const u={role:"department_entry",department:"PACKING",permissions:["department.packing.read"]};
 assert.equal(portalSectionForUser(u),"PACKING");
 assert.equal(pageAllowedForPortal(u,"Department Workspace:PACKING"),true);
 assert.equal(pageAllowedForPortal(u,"Department Workspace:FABRIC"),false);
 assert.equal(pageAllowedForPortal(u,"Department Tasks"),true);
 assert.equal(pageAllowedForPortal(u,"Department Approval Requests"),true);
 assert.equal(pageAllowedForPortal(u,"Company Dashboard"),false);
 assert.equal(pageAllowedForPortal(u,"SaaS Owner Dashboard"),false);
 assert.equal(pageAllowedForPortal({...u,role:"department_incharge"},"Management Approval Inbox"),true);
});
test("P0: dedicated Company Admin nav is the sole section, stale route is blocked",()=>{
 const nav=file("../src/components/layout/MainLayout.jsx");
 const app=file("../src/App.jsx");
 const routes=file("../src/routes/AppRoutes.jsx");
 const dash=file("../src/pages/dashboard/CompanyAdminDashboardPage.jsx");
 assert.match(nav,/sidebarSectionAllowed\(user,department\)/);
 assert.match(nav,/showExtraNavigation\(user\)/);
 assert.match(nav,/COMPANY ADMIN PORTAL/);
 assert.match(app,/visiblePageForUser\(user,page\)/);
 assert.match(routes,/pageAllowedForPortal\(user,page\)/);
 assert.doesNotMatch(dash,/onPageChange\("Department Workspace:/);
});
