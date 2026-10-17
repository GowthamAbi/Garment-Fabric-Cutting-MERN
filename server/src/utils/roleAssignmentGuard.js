import ApiError from "./ApiError.js";
import {hasPermission,strictAccess,companyOwner} from "./accessPolicy.js";
// Base-role privileges exist beyond permissions on older routes. Only a
// customer company owner can assign/modify company_admin and admin accounts.
const ownerOnlyRoles=new Set(["company_admin","admin"]);
export function assertSafeBaseRoleAssignment(actor,newRole,previousRole=""){
 if(!actor||["saas_super_admin","support_viewer"].includes(actor.role))
  throw new ApiError(403,"Customer owner authorization required for privileged role management");
 if(!companyOwner(actor)&&
  (ownerOnlyRoles.has(String(newRole||""))||ownerOnlyRoles.has(String(previousRole||""))))
  throw new ApiError(403,"Only the company owner can assign or modify an administrator role");
 return true;
}
// List role-assignable users only inside the actor's factory/department,
// not every employee in the company. User lookup is always tenant scoped.
export function roleDirectoryFilter(actor){
 if(!actor?.companyId||(!hasPermission(actor,"users.roles.assign")&&
    !hasPermission(actor,"roles.manage")))
  throw new ApiError(403,"Role directory permission required");
 const filter={companyId:actor.companyId};
 if(companyOwner(actor)||actor.accessScope==="COMPANY"||
    (actor.role==="company_admin"&&!strictAccess(actor)))return filter;
 if(actor.accessScope==="SELF")throw new ApiError(403,"Self profile scope has no user directory");
 const keys=actor.role==="admin"?[actor.factoryId]:
  actor.assignedFactoryIds?.length?actor.assignedFactoryIds:[actor.factoryId];
 const ids=[...new Set((keys||[]).filter(Boolean).map(String))];
 if(!ids.length||ids.some(id=>!/^[a-f0-9]{24}$/i.test(id)))
  throw new ApiError(403,"Assigned factory context required");
 filter.factoryId={$in:ids};
 if(strictAccess(actor)&&actor.accessScope==="DEPARTMENT"){
  if(!actor.department)throw new ApiError(403,"Assigned department required");
  filter.department=actor.department;
 }
 return filter;
}
