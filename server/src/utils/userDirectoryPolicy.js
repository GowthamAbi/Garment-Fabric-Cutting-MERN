import ApiError from "./ApiError.js";
import {strictAccess} from "./accessPolicy.js";

const allowedDirectoryRoles=new Set(["saas_super_admin","company_admin","admin"]);

export function userDirectoryFilter(actor){
 if(!actor||!allowedDirectoryRoles.has(actor.role))throw new ApiError(403,"User directory permission required");
 // The SaaS owner is restricted by the already resolved platform tenant context.
 if(actor.role==="saas_super_admin")return {};
 if(!actor.companyId)throw new ApiError(403,"Company context required");
 if(strictAccess(actor)&&!(actor.permissions||[]).includes("users.manage"))
  throw new ApiError(403,"User management permission required");
 if(actor.accessScope==="SELF")throw new ApiError(403,"User directory is outside self scope");

 const query={companyId:actor.companyId};
 if(actor.role==="company_admin"&&(!strictAccess(actor)||actor.accessScope==="COMPANY"))return query;

 // A factory administrator, or a company administrator without company-wide
 // authority, must never enumerate staff from unrelated factories.
 const ids=actor.role==="admin" ? [actor.factoryId] :
  actor.accessScope==="COMPANY" ? [] :
   actor.assignedFactoryIds?.length ? actor.assignedFactoryIds : [actor.factoryId];
 if(!ids.length||ids.some(id=>!id))throw new ApiError(403,"Factory assignment required");
 query.factoryId={$in:[...new Set(ids.map(String))]};
 if(strictAccess(actor)&&actor.accessScope==="DEPARTMENT"){
  if(!actor.department)throw new ApiError(403,"Department assignment required");
  query.department=actor.department;
 }
 return query;
}
