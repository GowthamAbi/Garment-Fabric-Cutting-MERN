import {getDepartmentSidebar} from "./departmentRoleSidebars.js";
import {EXCEL_PAGE_PREFIX} from "./excelOptionNavigation.mjs";

// Access-aware navigation for single-department user accounts.
// The backend remains authoritative; these entries never grant permission.
const DEPARTMENT_ROLES=new Set(["department_incharge","department_entry"]);
const readGrant=d=>"department."+d.toLowerCase()+".read";
const writeGrant=d=>"department."+d.toLowerCase()+".write";

export function isSingleDepartmentUser(user){
 return DEPARTMENT_ROLES.has(user?.role)&&(
   user.accessScope==="DEPARTMENT"||
   !user.accessPolicyVersion&&Boolean(user.department)
 );
}

export function roleDepartmentPages(user,subscription){
 if(!isSingleDepartmentUser(user))return [];
 if(subscription?.accessAllowed===false)return [];
 const dept=String(user.department||"").toUpperCase();
 if(!/^[A-Z]{2,20}$/.test(dept))return [];
 const permissions=user.permissions||[];
 const canRead=permissions.includes(readGrant(dept))||permissions.includes(writeGrant(dept));
 if(!canRead)return [];
 // After the subscription query arrives, never advertise an unlicensed workspace.
 if(subscription&&(!Array.isArray(subscription.enabledDepartments)||!subscription.enabledDepartments.includes(dept)))return [];
 const pages=[{label:"My Department Dashboard",page:"Department Dashboard",action:"read"},
  {label:dept+" Workspace",page:"Department Workspace:"+dept,action:user.role==="department_entry"?"write":"read"}];
 if(user.role==="department_entry"&&permissions.includes(writeGrant(dept)))
   pages.push({label:"Submit Approval Requests",page:"Department Approval Requests",action:"request"});
 if(user.role==="department_incharge"&&permissions.includes("approval.head."+dept.toLowerCase()))
   pages.push({label:"My Approval Inbox",page:"Management Approval Inbox",action:"approve"});
 pages.push({label:"My Tasks & Follow-ups",page:"Department Tasks",action:user.role==="department_entry"?"status":"read"});
 const kind=user.role==="department_incharge"?"HEAD":"STAFF";
 const canWrite=permissions.includes(writeGrant(dept));
 for(const option of getDepartmentSidebar(dept,kind,{enabledDepartments:subscription?.enabledDepartments})){
   if(option.action==="approve"&&!permissions.includes("approval.head."+dept.toLowerCase()))continue;
   if(kind==="STAFF"&&option.action==="write"&&!canWrite)continue;
   pages.push({label:option.label,page:EXCEL_PAGE_PREFIX+option.id,action:option.action,excelCell:option.id});
 }
 pages.push({label:"Profile Settings",page:"Profile Settings",action:"profile"});
 return pages;
}

export function rolePageAllowed(user,page,subscription){
 if(!isSingleDepartmentUser(user))return true;
 if(page==="Profile Settings")return true;
 return roleDepartmentPages(user,subscription).some(entry=>entry.page===page);
}
