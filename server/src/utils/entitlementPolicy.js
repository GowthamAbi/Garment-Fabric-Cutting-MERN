import ApiError from "./ApiError.js";
import {departmentCode,DEPARTMENTS} from '../../../shared/departmentCatalogue.js';
export function checkUserQuota(entitlements,users,newDepartment,company) {
  if(!entitlements) throw new ApiError(409,"Subscription limits need configuration before creating users");
  if(!Number.isInteger(entitlements.maxUsers)||!Number.isInteger(entitlements.maxDepartments)) throw new ApiError(409,"Invalid subscription limits");
  if(users.length>=entitlements.maxUsers) throw new ApiError(409,"Subscription user limit reached");
  const departments=new Set(users.map(u=>String(u.department||"").trim().toUpperCase()).filter(Boolean));
  const department=String(newDepartment||"").trim().toUpperCase();if(department) departments.add(department);
  if(company?.departmentCatalogueVersion>=1&&department&&(!DEPARTMENTS.includes(departmentCode(department))||!company.enabledDepartments?.includes(departmentCode(department))))throw new ApiError(409,'User department is not enabled for this company');
  if(departments.size>entitlements.maxDepartments) throw new ApiError(409,"Subscription department limit reached");
}
