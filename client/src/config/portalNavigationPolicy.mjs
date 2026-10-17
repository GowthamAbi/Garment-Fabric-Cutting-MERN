// Single-portal navigation boundary. This is a UI guard, not a substitute
// for API authorization, tenant isolation or subscription enforcement.
import {DEPARTMENTS} from "../../../../shared/departmentCatalogue.js";
const COMPANY_PAGES = new Set([
  "Company Dashboard","Factory Management","Company Reports","Company Timeline",
  "Company Stock","Company Approvals","Company Purchase Orders",
  "User Management","Item Master","Audit & Backup","Setup Guide",
  "Subscription Plan","Subscription Purchase","Subscription Bills",
  "Subscription Usage","Support Access","Subscription Automation",
  "Profile Settings","Account Details"
]);
const FACTORY_ADMIN_PAGES = new Set([
  "Admin Dashboard","Department Approvals","Item Master",
  "User Management","Audit & Backup","Setup Guide",
  "Profile Settings","Account Details"
]);
const OWNER_PAGES = new Set([
  "SaaS Owner Dashboard","Companies","Plans","Payments & Sales",
  "Lead CRM","Subscriptions","Owner Users","Audit & Backup",
  "Subscription Automation","Owner Settings","Account Details","Profile Settings"
]);
const LEGACY_DEPARTMENT_ROLES = {
  FABRIC:["fabric_admin","fabric_entry"],
  CUTTING:["cutting_admin","cutting_entry"],
  DELIVERY:["delivery_admin","delivery_entry"],
  ELASTIC:["elastic_admin","elastic_entry","production","production_planner","production_operator","supervisor","quality","maintenance","sewing_coordinator"],
  ACCESSORIES:["accessories_admin","accessories_entry","store"]
};
export function portalSectionForUser(user){
  if(!user)return null;
  const role=user.role;
  if(role==="saas_super_admin")return "SAAS_OWNER";
  if(role==="company_admin"||role==="company_owner")return "COMPANY_ADMIN";
  if(role==="admin")return "ADMIN";
  const department=String(user.department||"").toUpperCase();
  if(department&&DEPARTMENTS.includes(department)&&
     ["department_entry","department_incharge"].includes(role))return department;
  if(department&&Object.hasOwn(LEGACY_DEPARTMENT_ROLES,department))return department;
  for(const [code,roles] of Object.entries(LEGACY_DEPARTMENT_ROLES)){
    if(roles.includes(role))return code;
  }
  return null;
}
export function sidebarSectionAllowed(user,section){
  return portalSectionForUser(user)===section;
}
export function portalLandingPage(user){
  const section=portalSectionForUser(user);
  if(section==="SAAS_OWNER")return "SaaS Owner Dashboard";
  if(section==="COMPANY_ADMIN")return "Company Dashboard";
  if(section==="ADMIN")return "Admin Dashboard";
  if(["department_entry","department_incharge"].includes(user?.role))return "Department Dashboard";
  return "Dashboard";
}
export function pageAllowedForPortal(user,page){
  if(!user||typeof page!=="string")return false;
  const section=portalSectionForUser(user);
  if(section==="COMPANY_ADMIN")return COMPANY_PAGES.has(page);
  if(section==="ADMIN")return FACTORY_ADMIN_PAGES.has(page);
  if(section==="SAAS_OWNER")return OWNER_PAGES.has(page);
  if(["department_entry","department_incharge"].includes(user.role)){
    if(page==="Department Dashboard"||page==="Profile Settings"||page==="Account Details")return true;
    if(page==="Department Workspace:"+String(user.department||"").toUpperCase())return true;
    // Existing in-department navigation is granted by server-side permissions.
    // Prevent cross-department workspace selection in the client.
    if(page.startsWith("Department Workspace:"))return false;
  }
  return !page.startsWith("Department Workspace:")||page==="Department Workspace:"+String(user.department||"").toUpperCase();
}
export function visiblePageForUser(user,page){
  return pageAllowedForPortal(user,page)?page:portalLandingPage(user);
}
export function showExtraNavigation(user){
  return !["company_admin","company_owner","admin","department_entry","department_incharge","saas_super_admin"].includes(user?.role);
}
