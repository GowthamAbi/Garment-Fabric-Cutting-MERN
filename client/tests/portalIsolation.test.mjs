import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 portalSectionForUser,sidebarSectionAllowed,portalLandingPage,
 pageAllowedForPortal,visiblePageForUser,showExtraNavigation
} from "../src/config/portalNavigationPolicy.mjs";

const file=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const company={role:"company_admin",companyId:"acme",accessPolicyVersion:1};
const owner={role:"company_owner",companyId:"acme"};
const factory={role:"admin",department:"ADMIN",companyId:"acme"};
const fabricHead={role:"department_incharge",department:"FABRIC",
 permissions:["department.fabric.read"],accessScope:"DEPARTMENT"};
const packingStaff={role:"department_entry",department:"PACKING",
 permissions:["department.packing.read"],accessScope:"DEPARTMENT"};

test("Company Admin sees only Company Admin portal, not department or factory admin portal",()=>{
 for(const u of [company,owner]){
  assert.equal(portalSectionForUser(u),"COMPANY_ADMIN");
  assert.equal(sidebarSectionAllowed(u,"COMPANY_ADMIN"),true);
  for(const d of ["ADMIN","FABRIC","CUTTING","DELIVERY","ELASTIC","ACCESSORIES","WAREHOUSE","SHOP"]){
   assert.equal(sidebarSectionAllowed(u,d),false,u.role+" unexpectedly sees "+d);
  }
  assert.equal(showExtraNavigation(u),false);
  assert.equal(portalLandingPage(u),"Company Dashboard");
 }
});
test("Company Admin can manage company functions but cannot open department or SaaS owner pages",()=>{
 for(const page of ["Company Dashboard","Factory Management","Company Reports","Company Timeline",
  "Company Stock","Company Approvals","Company Purchase Orders","User Management","Item Master",
  "Audit & Backup","Subscription Plan","Subscription Purchase","Subscription Bills",
  "Subscription Usage","Support Access","Subscription Automation","Profile Settings"]){
  assert.equal(pageAllowedForPortal(company,page),true,page);
 }
 for(const page of ["Admin Dashboard","Fabric Dashboard","Cutting Dashboard","Delivery Dashboard",
  "Fabric Master","Fabric Inward Entry","Production Departments","Integrated ERP",
  "Production & Retail","Warehouse Management","Shop Management","Marketing Analysis",
  "Modules","SaaS Companies","SaaS Owner Dashboard","Companies","Owner Users",
  "Department Workspace:FABRIC","Department Workspace:DELIVERY","Department Approvals"]){
  assert.equal(pageAllowedForPortal(company,page),false,page);
  assert.equal(visiblePageForUser(company,page),"Company Dashboard");
 }
});
test("Factory Admin never sees Company Admin, Owner or Fabric portal",()=>{
 assert.equal(portalSectionForUser(factory),"ADMIN");
 assert.equal(sidebarSectionAllowed(factory,"ADMIN"),true);
 for(const portal of ["COMPANY_ADMIN","FABRIC","CUTTING","DELIVERY","ELASTIC","WAREHOUSE"])
  assert.equal(sidebarSectionAllowed(factory,portal),false);
 assert.equal(showExtraNavigation(factory),false);
 assert.equal(pageAllowedForPortal(factory,"Admin Dashboard"),true);
 assert.equal(pageAllowedForPortal(factory,"Company Dashboard"),false);
 assert.equal(pageAllowedForPortal(factory,"Department Workspace:FABRIC"),false);
 assert.equal(visiblePageForUser(factory,"Fabric Master"),"Admin Dashboard");
});
test("Department logins only see their own department sidebar and workspace",()=>{
 assert.equal(portalSectionForUser(fabricHead),"FABRIC");
 assert.equal(sidebarSectionAllowed(fabricHead,"CUTTING"),false);
 assert.equal(sidebarSectionAllowed(fabricHead,"FABRIC"),true);
 assert.equal(pageAllowedForPortal(fabricHead,"Department Workspace:FABRIC"),true);
 assert.equal(pageAllowedForPortal(fabricHead,"Department Workspace:CUTTING"),false);
 assert.equal(showExtraNavigation(fabricHead),false);
 assert.equal(pageAllowedForPortal(fabricHead,"Company Dashboard"),false);
 assert.equal(pageAllowedForPortal(fabricHead,"Admin Dashboard"),false);
 assert.equal(pageAllowedForPortal(fabricHead,"SaaS Owner Dashboard"),false);
 assert.equal(pageAllowedForPortal(fabricHead,"Cutting Dashboard"),false);
 assert.equal(pageAllowedForPortal(fabricHead,"Fabric Dashboard"),true);
 assert.equal(portalSectionForUser(packingStaff),"PACKING");
 assert.equal(pageAllowedForPortal(packingStaff,"Department Workspace:PACKING"),true);
 assert.equal(pageAllowedForPortal(packingStaff,"Department Workspace:FABRIC"),false);
 assert.equal(portalLandingPage(packingStaff),"Department Dashboard");
 assert.notEqual(portalSectionForUser({role:"department_entry",department:"COMPANY_ADMIN"}),"COMPANY_ADMIN");
});
test("SaaS owner uses SaaS owner console only",()=>{
 const platform={role:"saas_super_admin"};
 assert.equal(portalSectionForUser(platform),"SAAS_OWNER");
 assert.equal(portalLandingPage(platform),"SaaS Owner Dashboard");
 assert.equal(sidebarSectionAllowed(platform,"COMPANY_ADMIN"),false);
 assert.equal(pageAllowedForPortal(platform,"SaaS Owner Dashboard"),true);
 assert.equal(pageAllowedForPortal(platform,"Company Dashboard"),false);
});
test("Navigation and content both use policy guard; no Company Admin direct department button",()=>{
 const layout=file("../src/components/layout/MainLayout.jsx");
 const app=file("../src/App.jsx");
 const routes=file("../src/routes/AppRoutes.jsx");
 const dashboard=file("../src/pages/dashboard/CompanyAdminDashboardPage.jsx");
 assert.match(layout,/sidebarSectionAllowed\(user,department\)/);
 assert.match(layout,/COMPANY ADMIN PORTAL/);
 assert.match(layout,/FACTORY ADMIN PORTAL/);
 assert.match(layout,/showExtraNavigation\(user\)/);
 assert.match(layout,/!departmentNavigation\[activePortal\]/);
 assert.match(app,/const visiblePage = visiblePageForUser\(user,page\)/);
 assert.match(app,/<MainLayout page=\{visiblePage\}/);
 assert.match(app,/<AppRoutes page=\{visiblePage\}/);
 assert.match(routes,/if\(!pageAllowedForPortal\(user,page\)\)/);
 assert.doesNotMatch(dashboard,/onPageChange\("Department Workspace:/);
 assert.match(dashboard,/Company Admin portal/);
});
