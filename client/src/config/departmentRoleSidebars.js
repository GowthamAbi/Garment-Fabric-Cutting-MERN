// Exact workbook role menu definitions. Menus are not proof of working APIs or authorization.
import {DEPARTMENTS,departmentCode} from "../../../shared/departmentCatalogue.js";
import {requirementsForRole,EXCEL_DEPARTMENT_CODES} from "../../../shared/excelRequirementCatalogue.js";

export const PROPOSED_DEPARTMENTS=Object.freeze([...EXCEL_DEPARTMENT_CODES]);
export const NOT_YET_LICENSED=Object.freeze(["HR","ACCOUNTS"]);
export const WORKSPACE_ROLES=Object.freeze({HEAD:"HEAD",STAFF:"STAFF"});

function actionForRequirement(role,label){
 const text=String(label||"").toLowerCase();
 if(role==="HEAD")return /pending approvals/.test(text)?"approve":/dashboard/.test(text)?"overview":"read";
 if(/dashboard/.test(text))return "overview";
 if(/request/.test(text))return "request";
 if(/history|reports|print|status|stock|progress|pending|ready|completed plans|availability|view/.test(text))return "read";
 return "write";
}

export function getDepartmentSidebar(department,role,options={}){
 const code=departmentCode(department);
 const kind=String(role||"").toUpperCase();
 if(!PROPOSED_DEPARTMENTS.includes(code)||!Object.values(WORKSPACE_ROLES).includes(kind))return [];
 if(NOT_YET_LICENSED.includes(code)&&!options.experimentalDepartments)return [];
 if(options.enabledDepartments&&!options.enabledDepartments.map(departmentCode).includes(code))return [];
 const roleName=kind==="HEAD"?"Department Head":"Inventory / Staff";
 return requirementsForRole("Department",code,roleName).map((r,index)=>({
  id:r.id,label:r.label,action:actionForRequirement(kind,r.label),department:code,
  excelSourceCell:r.id,order:index+1,implementationStatus:r.status,
  requiresServerAuthorization:true
 }));
}
export function isDepartmentWorkspaceReady(department){return DEPARTMENTS.includes(departmentCode(department));}
