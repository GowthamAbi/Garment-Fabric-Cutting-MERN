// Server-owned decision rules for company/factory-scoped task coordination.
// This is workflow/task tracking only. No posting into stock, payroll or ledgers.
import {DEPARTMENTS,departmentCode} from "../../../shared/departmentCatalogue.js";
export const TASK_STATUSES=Object.freeze(["PENDING","IN_PROGRESS","DONE"]);
export const TASK_PRIORITIES=Object.freeze(["NORMAL","HIGH","URGENT"]);
const MANAGERS=new Set(["company_owner","company_admin","admin","management"]);
const has=(user,permission)=>(user?.permissions||[]).includes(permission);
export function taskDepartmentFor(user,requested){
 const code=departmentCode(requested||user?.department);
 if(!DEPARTMENTS.includes(code))return null;
 if(["department_incharge","department_entry"].includes(user?.role)){
  if(user.accessScope!=="DEPARTMENT"&&user.accessPolicyVersion>=1)return null;
  if(departmentCode(user.department)!==code)return null;
  if(!has(user,`department.${code.toLowerCase()}.read`)&&!has(user,`department.${code.toLowerCase()}.write`))return null;
  return code;
 }
 if(!MANAGERS.has(user?.role))return null;
 if(user?.role==="management"){
  if(user.accessScope==="SELF"||user.accessScope==="DEPARTMENT")return null;
  if(!has(user,"erp.read")&&!has(user,`department.${code.toLowerCase()}.read`))return null;
  if(user.accessPolicyVersion>=1&&!(user.assignedFactoryIds||[]).map(String).includes(String(user.factoryId)))return null;
 }
 if(user?.role==="company_admin"&&user.accessPolicyVersion>=1&&user.accessScope!=="COMPANY"&&!has(user,"erp.read"))return null;
 return code;
}
export function mayAssignTask(user,department){
 const code=taskDepartmentFor(user,department);
 if(!code)return false;
 if(["company_owner","admin"].includes(user.role))return true;
 if(user.role==="company_admin")return user.accessPolicyVersion<1||user.accessScope==="COMPANY"||has(user,"users.manage");
 if(user.role==="management")return has(user,"users.manage")||has(user,"department."+code.toLowerCase()+".write");
 return false;
}
export function mayUpdateAssignedTask(user,task){
 return user?.role==="department_entry"&&taskDepartmentFor(user,task?.department)===task?.department&&String(task.assigneeId)===String(user.id)&&has(user,`department.${task.department.toLowerCase()}.write`);
}
export function validTaskTransition(from,to){
 return from==="PENDING"&&["IN_PROGRESS","DONE"].includes(to)||from==="IN_PROGRESS"&&to==="DONE";
}
export function validateTaskInput(body){
 const title=typeof body?.title==="string"?body.title.trim():"";
 const notes=typeof body?.notes==="string"?body.notes.trim():"";
 const priority=body?.priority||"NORMAL";
 const reference=typeof body?.reference==="string"?body.reference.trim():"";
 const dueAt=body?.dueAt?new Date(body.dueAt):null;
 if(!title||title.length>160||notes.length>1000||reference.length>100||!TASK_PRIORITIES.includes(priority)||body?.dueAt&&(Number.isNaN(dueAt?.getTime())||!/^\d{4}-\d{2}-\d{2}$/.test(body.dueAt)))return null;
 return {title,notes,reference,priority,dueAt};
}
