import {DEPARTMENTS,departmentCode} from "../../../shared/departmentCatalogue.js";

export function approvalFactoryAllowed(user,company){
 if(!user||!company||String(company._id)!==String(user.companyId)||user.accessScope==="SELF")return false;
 const active=Array.isArray(company.factories)&&company.factories.some(f=>
  String(f._id)===String(user.factoryId)&&f.active!==false);
 if(!active)return false;
 // Defence in depth: a strict delegated reviewer cannot use another factory's
 // active tenant context without an explicit factory assignment.
 if(user.accessPolicyVersion>=1&&user.role!=="company_owner"&&
  !(user.assignedFactoryIds||[]).map(String).includes(String(user.factoryId)))return false;
 return true;
}

export function licensedApprovalDepartments(company){
 const enabled=Array.isArray(company?.enabledDepartments)?company.enabledDepartments:[];
 return DEPARTMENTS.filter(d=>enabled.includes(d));
}

export function verifiedCompanyOwner(user,company){
 return user?.role==="company_owner"&&approvalFactoryAllowed(user,company)&&
  Boolean(company.ownerUserId)&&String(company.ownerUserId)===String(user.id);
}

export function reviewableApprovalDepartments(user,company){
 if(!approvalFactoryAllowed(user,company)||user.accessScope==="SELF")return [];
 const enabled=licensedApprovalDepartments(company);
 if(user.role==="company_owner")return verifiedCompanyOwner(user,company)?enabled:[];
 if(user.role==="department_incharge"){
  return enabled.filter(d=>departmentCode(user.department)===d&&
    user.permissions?.includes(`department.${d.toLowerCase()}.read`)&&
    user.permissions?.includes(`approval.head.${d.toLowerCase()}`));
 }
 if(user.role==="management"){
  return enabled.filter(d=>(user.accessScope!=="DEPARTMENT"||departmentCode(user.department)===d)&&
   user.permissions?.includes(`approval.fm.${d.toLowerCase()}`));
 }
 return [];
}

export function canSubmitApproval(user,company){
 const d=departmentCode(user?.department);
 return user?.role==="department_entry" && user.accessScope!=="SELF" &&
  approvalFactoryAllowed(user,company) && licensedApprovalDepartments(company).includes(d) &&
  user.permissions?.includes(`department.${d.toLowerCase()}.write`);
}

 // Historic approval requests may contain sensitive purchasing, financial and
 // operational amounts. The old base-role name is not sufficient for strict users.
export function canReadApprovalHistory(user,department){
 const d=departmentCode(department);
 if(!DEPARTMENTS.includes(d)||!user||user.accessScope==="SELF")return false;
 if(user.role==="company_owner")return true; // only after verifiedCompanyOwner
 if(["company_admin","admin"].includes(user.role)){
  if(user.accessPolicyVersion>=1){
   if(user.accessScope==="DEPARTMENT"&&departmentCode(user.department)!==d)return false;
   return (user.permissions||[]).includes("company.settings")&&user.accessScope==="COMPANY"||
    (user.permissions||[]).includes(`department.${d.toLowerCase()}.read`);
  }
  return true; // preserved legacy read subject to company/factory check
 }
 return departmentCode(user.department)===d &&
   (user.permissions||[]).includes(`department.${d.toLowerCase()}.read`);
}
export function canReadApprovalSettings(user){
 if(!user||user.accessScope==="SELF")return false;
 if(user.role==="company_owner")return true; // verified separately
 if(user.role!=="company_admin")return false;
 return user.accessPolicyVersion<1||
  user.accessScope==="COMPANY"&&(user.permissions||[]).includes("company.settings");
}
