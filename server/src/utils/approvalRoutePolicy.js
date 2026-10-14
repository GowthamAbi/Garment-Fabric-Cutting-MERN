// Routes explicitly allowed through the V1 strict-access boundary.
// Route controllers MUST still enforce company/factory IDs, department licensing,
// approval grants, reviewer independence and monetary limits.
const decisionPath=/^\/department-approval-requests\/[0-9a-f]{24}\/decision$/i;
const departmentRead=user=>Boolean(user.department && (user.permissions||[]).includes(`department.${String(user.department).toLowerCase()}.read`));
const departmentWrite=user=>Boolean(user.department && (user.permissions||[]).includes(`department.${String(user.department).toLowerCase()}.write`));

export function approvalRouteAllowed(user,path,method){
 if(typeof path!=="string"||typeof method!=="string"||!user||user.accessScope==="SELF")return false;
 if(path==="/approval-grants"||path.startsWith("/approval-grants/"))return false; // verified owners bypass the strict boundary separately
 if(!/^\/department-approval-requests(?:\/|$)/.test(path))return false;
 const role=user.role;
 if(role==="department_entry"){
  if(path==="/department-approval-requests"&&method==="GET")return departmentRead(user);
  if(path==="/department-approval-requests"&&method==="POST")return departmentWrite(user);
  return false;
 }
 if(role==="department_incharge"){
  if(path==="/department-approval-requests"&&method==="GET")return departmentRead(user);
  if(path==="/department-approval-requests/inbox"&&method==="GET")return departmentRead(user);
  if(decisionPath.test(path)&&method==="POST")return departmentRead(user);
  return false;
 }
 if(role==="management"){
  if(path==="/department-approval-requests/inbox"&&method==="GET")return true;
  if(decisionPath.test(path)&&method==="POST")return true;
  return false;
 }
 if(role==="company_admin"){
  if(path==="/department-approval-requests/settings"&&method==="GET")return true;
  if(path==="/department-approval-requests"&&method==="GET")return true;
 }
 if(role==="admin"&&path==="/department-approval-requests"&&method==="GET")return true;
 return false;
}
