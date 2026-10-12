import {DEPARTMENT_PERMISSIONS} from './departmentCatalogue.js';
export const ACCESS_PERMISSIONS=Object.freeze([...DEPARTMENT_PERMISSIONS,'erp.read','erp.purchase','erp.sales','erp.stock','erp.quality','erp.accounts','erp.finance.read','erp.masters','erp.reverse','erp.reconcile','users.manage','users.roles.assign','roles.manage','company.settings','billing.manage','audit.read','support.manage','hr.payroll.read','hr.payroll.write','hr.payroll.approve','inventory.adjust.approve']);
export const ACCESS_SCOPES=Object.freeze(['COMPANY','LOCATION','DEPARTMENT','SELF']);
const dept=(code,write=true)=>[`department.${code.toLowerCase()}.read`,...(write?[`department.${code.toLowerCase()}.write`]:[])];
export const ROLE_TEMPLATES=Object.freeze([
 {key:'COMPANY_ADMIN',label:'Company Admin',baseRole:'company_admin',permissions:['users.manage','users.roles.assign','erp.read','erp.masters'],scope:'COMPANY'},
 {key:'FACTORY_ADMIN',label:'Factory Admin',baseRole:'department_incharge',permissions:['erp.read','erp.stock','erp.quality','erp.masters',...['CUTTING','STITCHING','INWARD','CHECKING','IRONING','PACKING','DISPATCH'].flatMap(d=>dept(d))],scope:'LOCATION'},
 {key:'WAREHOUSE_ADMIN',label:'Warehouse Admin',baseRole:'department_incharge',permissions:[...dept('WAREHOUSE')],scope:'LOCATION'},
 {key:'SHOP_ADMIN',label:'Retail Shop Admin',baseRole:'department_incharge',permissions:[...dept('SHOP')],scope:'LOCATION'},
 {key:'MARKETING_ADMIN',label:'Sales / Marketing Admin',baseRole:'management',permissions:['erp.read','erp.sales',...dept('MARKETING')],scope:'LOCATION'},
 {key:'ACCOUNTS_ADMIN',label:'Accounts Admin',baseRole:'management',permissions:['erp.read','erp.finance.read','erp.accounts','erp.reconcile'],scope:'LOCATION'},
 {key:'PURCHASE_MANAGER',label:'Purchase Manager',baseRole:'management',permissions:['erp.read','erp.purchase','erp.masters'],scope:'LOCATION'},
 {key:'PRODUCT_MANAGER',label:'Product and BOM Manager',baseRole:'management',permissions:['erp.read','erp.masters'],scope:'LOCATION'},
 {key:'HR_PAYROLL_PREPARER',label:'HR / Payroll Preparer',baseRole:'management',permissions:['erp.read','hr.payroll.read','hr.payroll.write'],scope:'LOCATION'},
 {key:'PAYROLL_APPROVER',label:'Payroll Approver',baseRole:'company_admin',permissions:['erp.read','erp.accounts','hr.payroll.read','hr.payroll.approve'],scope:'LOCATION'},
 {key:'DISPATCH_MANAGER',label:'Dispatch Manager',baseRole:'department_incharge',permissions:[...dept('DISPATCH')],scope:'LOCATION'},
 {key:'AUDITOR',label:'Internal Auditor',baseRole:'view_only',permissions:['erp.read','erp.finance.read','audit.read'],scope:'LOCATION'},
 {key:'DEPARTMENT_OPERATOR',label:'Department Operator',baseRole:'department_entry',permissions:[],scope:'DEPARTMENT'},
 {key:'SELF_SERVICE',label:'Self service profile only',baseRole:'view_only',permissions:[],scope:'SELF'},
]);
