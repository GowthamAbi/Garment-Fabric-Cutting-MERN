import ApiError from '../utils/ApiError.js';
import {approvalRouteAllowed} from '../utils/approvalRoutePolicy.js';
import {hasPermission,strictAccess,companyOwner} from '../utils/accessPolicy.js';
import {enabledDepartment} from '../erp/departmentPolicy.js';
export function legacyDepartment(path){
 if(/^\/delivery\//.test(path))return 'DELIVERY';
 if(/^\/(items|pos|transactions)(\/|$)/.test(path))return 'ACCESSORIES';
 if(/^\/fabric-cutting\/elastic\//.test(path))return 'ELASTIC';
 if(/^\/fabric-cutting\/(actuals|waste)(\/|$)/.test(path))return 'CUTTING';
 if(/^\/fabric-cutting\/stock(\/|$)/.test(path))return 'FABRIC';
 if(/^\/fabric-cutting\/plans\/[^/]+\/folding$/.test(path))return 'FABRIC';
 if(/^\/fabric-cutting\/plans(\/|$)/.test(path))return 'CUTTING';
 if(/^\/fabric-cutting\/(masters|process-masters|item-masters|inwards|inward-stock|balance-stock|rolls)(\/|$)/.test(path))return 'FABRIC';
 if(/^\/production\/cutting-machine-(plans|status)(\/|$)/.test(path))return 'CUTTING';
 return null;
}
export function enforceAccessBoundary(req){
 const user=req.user;if(!strictAccess(user))return;
 const path=req.originalUrl.split('?')[0].replace(/^\/api/,'');
 if(companyOwner(user)){const department=legacyDepartment(path);if(department&&req.accessCompany&&!enabledDepartment(req.accessCompany,department))throw new ApiError(403,'Legacy department is not subscribed');return;}
 if(/^\/auth\/(session|logout|profile)$/.test(path)||path==='/saas/access-status')return;
 if(path.startsWith('/auth/factories')){if(user.accessScope==='SELF')throw new ApiError(403,'Self scope permits personal profile only');if(req.method==='GET'||hasPermission(user,'company.settings'))return;throw new ApiError(403,'Company settings permission required');}
 if(path.startsWith('/auth/access')){if(path==='/auth/access/factory'||hasPermission(user,'users.roles.assign')||hasPermission(user,'roles.manage'))return;throw new ApiError(403,'Role administration permission required');}
 if(path.startsWith('/auth/users')){if(hasPermission(user,'users.manage'))return;throw new ApiError(403,'User management permission required');}
 // New workflow APIs require explicit strict-access authorization before the
 // legacy unmapped-path gate, including users with DEPARTMENT scope.
 if(path==='/approval-grants'||path.startsWith('/approval-grants/')||path==='/department-approval-requests'||path.startsWith('/department-approval-requests/')){
  if(approvalRouteAllowed(user,path,req.method))return;
  throw new ApiError(403,'Approval workflow access denied');
 }
 if(user.accessScope==='SELF')throw new ApiError(403,'Self scope permits personal profile only');
 if(path.startsWith('/saas/')){if(path.startsWith('/saas/support')&&req.method!=='GET')throw new ApiError(403,'Only the company owner can issue or revoke owner support access');const permission=path.startsWith('/saas/customer-database')?'company.settings':path.includes('/support')?'support.manage':path.includes('/audit')?'audit.read':'billing.manage';if(hasPermission(user,permission))return;throw new ApiError(403,'Company account permission required');}
 if(path==='/dashboard/company-overview'&&hasPermission(user,'erp.read')&&user.accessScope!=='DEPARTMENT'&&!user.assignedShopKeys?.length&&!user.assignedWarehouseKeys?.length)return;
 if(path.startsWith('/companies')){if(req.method==='GET'&&hasPermission(user,'users.manage'))return;if(hasPermission(user,'company.settings'))return;throw new ApiError(403,'Company settings permission required');}
 if(path.startsWith('/erp/departments')){
  if(path==='/erp/departments/reconciliation'&&(!hasPermission(user,'erp.reconcile')||user.accessScope==='DEPARTMENT'||((user.assignedShopKeys?.length||user.assignedWarehouseKeys?.length)&&user.accessScope!=='COMPANY')))throw new ApiError(403,'Factory-wide reconciliation permission required');
  if(['/erp/departments/corrections','/erp/departments/undo'].includes(path)&&(!hasPermission(user,'erp.reverse')||user.accessScope==='DEPARTMENT'))throw new ApiError(403,'Movement reversal permission and broader reviewed scope required');
  if(path==='/erp/departments/management'&&(!hasPermission(user,'erp.read')||user.accessScope==='DEPARTMENT'||((user.assignedShopKeys?.length||user.assignedWarehouseKeys?.length)&&user.accessScope!=='COMPANY')))throw new ApiError(403,'Factory-wide management report permission required');
  if(path==='/erp/departments/labour-cost'&&!hasPermission(user,'erp.accounts'))throw new ApiError(403,'Cost posting permission required');
  if(/\/stock-exceptions\/[^/]+\/decision$/.test(path)&&!hasPermission(user,'inventory.adjust.approve'))throw new ApiError(403,'Stock adjustment approval permission required');
  return;
 }
 const department=legacyDepartment(path);
 if(department){
  if(user.accessScope==='DEPARTMENT'&&user.department!==department)throw new ApiError(403,'Department outside assigned scope');
  const permission=`department.${department.toLowerCase()}.${req.method==='GET'?'read':'write'}`;
  if(!hasPermission(user,permission)&&!(req.method==='GET'&&hasPermission(user,permission.replace('.read','.write'))))throw new ApiError(403,'Legacy department permission required');
  if(req.accessCompany&&!enabledDepartment(req.accessCompany,department))throw new ApiError(403,'Department not subscribed');
  req.authorizedLegacyDepartment=department;return;
 }
 if(user.accessScope==='DEPARTMENT')throw new ApiError(403,'Use the assigned department workflow; broader reports are outside department scope');
 if(path.startsWith('/erp/workforce')&&!hasPermission(user,'hr.payroll.read'))throw new ApiError(403,'Payroll access permission required');
 if(path.startsWith('/erp/')||path==='/erp'){
  if((user.assignedShopKeys?.length||user.assignedWarehouseKeys?.length)&&user.accessScope!=='COMPANY')throw new ApiError(403,'Use location-filtered department operations');
  if(hasPermission(user,'erp.read'))return;
  throw new ApiError(403,'ERP read permission required');
 }
 // Unmapped legacy endpoints are denied for new policies, rather than trusting
 // a broad role name. They remain available to explicitly migrated legacy users.
 throw new ApiError(403,'This legacy endpoint has not been enabled for the assigned access policy');
}
