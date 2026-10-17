export const DEPARTMENT_CATALOGUE=Object.freeze([
 ['FABRIC','Fabric'],['CUTTING','Cutting'],['ELASTIC','Elastic'],['ACCESSORIES','Accessories'],['DELIVERY','Delivery'],
 ['STITCHING','Stitching'],['INWARD','Inward'],['CHECKING','Checking'],['IRONING','Ironing'],['PACKING','Packing'],
 ['DISPATCH','Dispatch'],['WAREHOUSE','Warehouse'],['SHOP','Shop'],['MARKETING','Marketing'],['HR','HR'],['ACCOUNTS','Accounts'],
].map(([code,label])=>Object.freeze({code,label})));
export const DEPARTMENTS=Object.freeze(DEPARTMENT_CATALOGUE.map(d=>d.code));
// Preserve the original garment-workflow license contract for pre-v1 tenants.
export const WORKFLOW_DEPARTMENTS=Object.freeze(DEPARTMENTS.slice(5,14));
export const ERP_MODULES=Object.freeze(['ERP_CORE','ERP_SHOP_FLOOR','ERP_FINANCE','ERP_HR']);
export function departmentCode(value){const code=String(value||'').trim().toUpperCase();return ({DESPATCH:'DISPATCH',SHOPE:'SHOP',STICHING:'STITCHING'})[code]||code;}
export function departmentSelection(values){
 if(!Array.isArray(values)||!values.length)throw new Error('Select at least one department');
 const codes=values.map(departmentCode);
 if(codes.some(d=>!DEPARTMENTS.includes(d))||new Set(codes).size!==codes.length)throw new Error('Select unique supported departments');
 return codes;
}
export function planModules(values){
 if(!Array.isArray(values))throw new Error('Plan modules must be an array');
 const codes=values.map(departmentCode);
 if(codes.some(d=>!DEPARTMENTS.includes(d)&&!ERP_MODULES.includes(d))||new Set(codes).size!==codes.length)throw new Error('Select unique supported departments and ERP features');
 if(!codes.some(d=>DEPARTMENTS.includes(d)))throw new Error('Plan requires at least one department');
 return codes;
}
export function licensedDepartments(modules){return (modules||[]).map(departmentCode).filter(d=>DEPARTMENTS.includes(d));}

export const DEPARTMENT_PERMISSIONS=Object.freeze(DEPARTMENTS.flatMap(d=>['read','write'].map(action=>`department.${d.toLowerCase()}.${action}`)));
