import {DEPARTMENTS,departmentCode} from "../../../shared/departmentCatalogue.js";

export function approvalFactoryAllowed(user,company){
 if(!user||!company||String(company._id)!==String(user.companyId))return false;
 return Array.isArray(company.factories)&&company.factories.some(f=>String(f._id)===String(user.factoryId)&&f.active!==false);
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
  return enabled.filter(d=>user.permissions?.includes(`approval.fm.${d.toLowerCase()}`));
 }
 return [];
}

export function canSubmitApproval(user,company){
 const d=departmentCode(user?.department);
 return user?.role==="department_entry" && user.accessScope!=="SELF" &&
  approvalFactoryAllowed(user,company) && licensedApprovalDepartments(company).includes(d) &&
  user.permissions?.includes(`department.${d.toLowerCase()}.write`);
}
