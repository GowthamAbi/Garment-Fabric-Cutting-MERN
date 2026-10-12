import {ACCESS_PERMISSIONS,ACCESS_SCOPES} from '../../../shared/accessCatalogue.js';
import {departmentCode,DEPARTMENTS} from '../../../shared/departmentCatalogue.js';
import ApiError from './ApiError.js';
export const strictAccess=user=>user?.accessPolicyVersion>=1;
export const companyOwner=user=>user?.role==='company_owner';
export function hasPermission(user,permission){
 if(['saas_super_admin','support_viewer'].includes(user?.role))return false;
 return companyOwner(user)||(user?.permissions||[]).includes(permission);
}
export function locationAllowed(user,kind,code,factoryId=user?.factoryId){
 if(!strictAccess(user)||companyOwner(user)||user?.accessScope==='COMPANY')return true;
 const keys=kind==='SHOP'?user.assignedShopKeys:user.assignedWarehouseKeys;
 return (keys||[]).includes(`${factoryId}:${code}`);
}
export function validateAccessAssignment(actor,target,input,company){
 if(!hasPermission(actor,'users.roles.assign'))throw new ApiError(403,'Role assignment permission required');
 if(target.role==='company_owner'||String(target._id)===String(company.ownerUserId))throw new ApiError(403,'Ownership cannot change through user assignments');
 if(String(target._id)===String(actor.id||actor._id))throw new ApiError(403,'A different authorized administrator must change your access');
 if(!companyOwner(actor)&&actor.accessScope!=='COMPANY'&&!(actor.assignedFactoryIds||[String(actor.factoryId)]).map(String).includes(String(target.factoryId)))throw new ApiError(403,'Target user is outside your assigned factories');
 const permissions=input.permissions;
 if(!Array.isArray(permissions)||new Set(permissions).size!==permissions.length||permissions.some(p=>!ACCESS_PERMISSIONS.includes(p)))throw new ApiError(400,'Select valid unique permissions');
 if(!companyOwner(actor)&&permissions.some(p=>!hasPermission(actor,p)))throw new ApiError(403,'Cannot delegate permissions you do not have');
 const scope=String(input.accessScope||''),factoryIds=input.assignedFactoryIds;
 if(!ACCESS_SCOPES.includes(scope)||!Array.isArray(factoryIds)||!factoryIds.length||new Set(factoryIds).size!==factoryIds.length)throw new ApiError(400,'Valid scope and assigned factories required');
 const validFactories=company.factories.map(f=>String(f._id));
 if(factoryIds.some(id=>!validFactories.includes(id)))throw new ApiError(403,'Factory is outside the company');
 if(!companyOwner(actor)&&actor.accessScope!=='COMPANY'&&(scope==='COMPANY'||factoryIds.some(id=>!(actor.assignedFactoryIds||[String(actor.factoryId)]).map(String).includes(id))))throw new ApiError(403,'Cannot expand your assigned location scope');
 const department=departmentCode(input.department||target.department);
 if(scope==='DEPARTMENT'&&(!DEPARTMENTS.includes(department)||!company.enabledDepartments.includes(department)))throw new ApiError(400,'Enabled department required for department scope');
 if(!companyOwner(actor)&&actor.accessScope==='DEPARTMENT'&&(scope!=='DEPARTMENT'||department!==actor.department))throw new ApiError(403,'Cannot delegate outside your department');
 if(scope==='SELF'&&permissions.length)throw new ApiError(400,'Self scope currently supports profile only; operational assigned-record access is not enabled');
 if(actor.accessScope==='SELF'&&scope!=='SELF')throw new ApiError(403,'Cannot expand self scope');
 const lists={};
 for(const field of ['assignedWarehouseKeys','assignedShopKeys']){
  const keys=input[field]||[];if(!Array.isArray(keys)||new Set(keys).size!==keys.length||keys.length>500||keys.some(k=>typeof k!=='string'||!/^([a-f0-9]{24}):[A-Za-z0-9_-]{2,60}$/.test(k)||!factoryIds.includes(k.split(':')[0])))throw new ApiError(400,'Use unique factoryId:locationCode assignments');
  if(!companyOwner(actor)&&actor.accessScope!=='COMPANY'&&keys.some(k=>!(actor[field]||[]).includes(k)))throw new ApiError(403,'Cannot expand warehouse/shop assignments');
  lists[field]=keys;
 }
 const effectiveFactories=scope==='COMPANY'?validFactories:factoryIds;
 return {accessPolicyVersion:1,accessScope:scope,assignedFactoryIds:effectiveFactories,...lists,permissions,department,factoryId:effectiveFactories.includes(String(target.factoryId))?target.factoryId:effectiveFactories[0]};
}
