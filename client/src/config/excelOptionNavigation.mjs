// Explicitly routed workbook options only. Never imply missing workflows exist.
// Server-side authorization and subscription checks remain authoritative.
import {EXCEL_REQUIREMENTS} from "../../../shared/excelRequirementCatalogue.js";
import {departmentCode} from "../../../shared/departmentCatalogue.js";

export const EXCEL_PAGE_PREFIX="Excel Option:";

const ROUTES=Object.freeze({
 FABRIC:{
  "Fabric Master":"Fabric Master",
  "Fabric Inward Entry":"Fabric Inward Entry",
  "Production Plan":"Fabric Entry",
  "Folding Entry":"Folding Entry",
  "Fabric Stock":"Fabric Stock Balance",
  "Batch & Set Tracking":"Fabric Operations Batches",
  "Roll QR Code Print":"Fabric Roll QR Print",
  "Inward & Plan History":"Fabric Operations History",
  "Reports & Print":"Fabric Operations Reports",
  "Inward & Roll Monitoring":"Fabric Operations Inward",
  "Production Plan Overview":"Fabric Plan Monitoring",
  "Issue to Cutting Monitoring":"Fabric Issue Monitoring",
  "Folding Status":"Fabric Operations Folding",
  "Fabric Stock & Shortage":"Fabric Stock Balance",
  "Fabric Reports":"Fabric Operations Reports",
  "Fabric Issue / Transfer":"Fabric Issue Entry",
  "Fabric Purchase & Availability":"Fabric Operations Availability",
 },
 CUTTING:{
  "Machine Master":"Cutting Machine Master",
  "Cutting Planning":"Machine Plan Entry",
  "Spreader Assignment":"Machine Plan Entry",
  "Cutter Assignment":"Machine Plan Entry",
  "Cutting Actual Entry":"Cutting Actual Entry",
  "Machine Start / Pause / Complete":"Machine Plan Entry",
  "Breakdown / Reason Entry":"Machine Plan Entry",
  "Cutting Stock & Pending":"Cutting Pending",
  "Gantt / Time Status":"Cutting Gantt Overview",
  "Waste / Recut Entry":"Cutting Waste",
  "QR & Bundle Print":"Machine Detail Entry & QR Print",
  "History & Machine Reports":"Machine Reports",
  "Target vs Actual":"Cutting Target vs Actual",
  "Cutting Plan Overview":"Cutting Plan History",
  "Spreader & Cutter Status":"Plan Number Status",
  "Cutting Pending & Stock":"Cutting Stock",
  "Waste & Recut Monitoring":"Cutting Waste",
  "Machine Downtime / Gantt":"Cutting Gantt Overview",
  "Cutting Reports":"Machine Reports",
 },
 ACCESSORIES:{
  "Accessories Master":"Master Data",
  "Purchase / Inward Entry":"Inward",
  "Accessories Stock":"Stock",
  "Issue History":"History",
  "Reports & Print":"Print",
  "Stock Availability":"Stock",
  "Accessories Purchase Status":"PO Pending",
  "Reports":"Reports",
 },
 ELASTIC:{
  "Elastic Material Master":"Production Masters",
  "Elastic Cutting Plan":"Production Planning",
  "Elastic Cutting Entry":"Production Control",
  "Elastic Stock & Balance":"Balance Elastic",
  "Elastic Issue / Return":"Section Delivery",
  "History":"Pending & Issues",
  "Print & Reports":"Reports",
  "Elastic Plan Overview":"Production Planning",
  "Elastic Cutting Progress":"Production Control",
  "Pending Issues / Shortage":"Pending & Issues",
 },
 DELIVERY:{
  "Vendor Registration":"Vendor Registration",
  "Completed Plans":"Delivery Plan Details",
  "Delivery Plan Entry":"Delivery Plan Details",
  "Section / Vendor Allocation":"Section Plan",
  "Delivery Challan Generate":"Section Plan",
  "Delivery Handover":"Section Plan",
  "Vendor Pending Qty":"Section History",
  "DC History":"Section History",
  "DC Print & Reports":"Section History",
  "Delivery Plans":"Delivery Plan Details",
  "Vendor / Section Status":"Section History",
  "Delivery Challan Monitoring":"Section History",
  "Delivered vs Pending":"Section History",
 },
 WAREHOUSE:{
  "Warehouse Stock Overview":"Warehouse Management",
  "Warehouse Stock":"Warehouse Management",
  "Stock Transfers":"Warehouse Management",
 },
 SHOP:{
  "Shop Sales Overview":"Shop Management",
  "Shop Stock":"Shop Management",
  "Sales History / Reports":"Shop Management",
 },
 MARKETING:{
  "Marketing Performance":"Marketing Analysis",
  "Sales & Demand Analysis":"Marketing Analysis",
  "Reports":"Marketing Analysis",
  "Marketing Reports":"Marketing Analysis",
 }
});

export function findExcelDepartmentOption(id){
 const value=String(id||"");
 const item=EXCEL_REQUIREMENTS.find(r=>r.id===value&&r.area==="Department");
 if(!item)return null;
 return {...item,departmentCode:departmentCode(item.department)};
}
export function excelOptionForUser(user,id){
 const item=findExcelDepartmentOption(id);
 if(!item||!user)return null;
 const role=user.role==="department_incharge"?"Department Head":user.role==="department_entry"?"Inventory / Staff":"";
 if(item.role!==role||item.departmentCode!==departmentCode(user.department))return null;
 return item;
}
export function excelOptionTarget(item){
 if(!item)return null;
 if(item.label==="Dashboard")return "Department Dashboard";
 if(item.role==="Department Head"&&/^(Staff & Tasks|Team & Tasks|QC Team & Tasks)$/.test(item.label))return "Department Tasks";
 if(item.label==="Pending Approvals"&&item.role==="Department Head")return "Management Approval Inbox";
 return ROUTES[item.departmentCode]?.[item.label]||null;
}
