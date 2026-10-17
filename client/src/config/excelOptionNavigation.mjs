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
  "Accessories Requirement":"Accessories Requirement",
  "Accessories Purchase Status":"Accessories Purchase Status",
  "Stock Availability":"Accessories Stock Availability",
  "Before-Sewing Issue Status":"Accessories Before Status",
  "After-Sewing Issue Status":"Accessories After Status",
  "Shortage & Consumption":"Accessories Shortage",
  "Reports":"Accessories Reports",
  "Accessories Master":"Accessories Master Workspace",
  "Purchase / Inward Entry":"Accessories Purchase Entry",
  "Accessories Stock":"Accessories Stock Workspace",
  "Before-Sewing Issue":"Accessories Before Issue",
  "After-Sewing Issue":"Accessories After Issue",
  "Return / Transfer Entry":"Accessories Return Transfer",
  "Shortage / Adjustment Request":"Accessories Adjustment Request",
  "Issue History":"Accessories History",
  "Reports & Print":"Accessories Reports",
 },
 ELASTIC:{
  "Elastic Plan Overview":"Elastic Plans Workspace",
  "Material Availability":"Elastic Material Availability",
  "Target vs Actual":"Elastic Target vs Actual",
  "Elastic Cutting Progress":"Elastic Progress Workspace",
  "Pending Issues / Shortage":"Elastic Shortage Workspace",
  "Wastage Monitoring":"Elastic Wastage Workspace",
  "Reports":"Elastic Reports Workspace",
  "Elastic Material Master":"Elastic Material Workspace",
  "Elastic Inward":"Elastic Inward Workspace",
  "Elastic Cutting Plan":"Elastic Cutting Plan Workspace",
  "Elastic Cutting Entry":"Elastic Cutting Entry Workspace",
  "Elastic Issue / Return":"Elastic Issue Return Workspace",
  "Elastic Stock & Balance":"Elastic Stock Workspace",
  "Wastage / Correction Request":"Elastic Correction Workspace",
  "History":"Elastic History Workspace",
  "Print & Reports":"Elastic Reports Workspace",
 },
 DELIVERY:{
  "Delivery Plans":"Delivery Plan Details",
  "Cutting & Folding Completion":"Delivery Completion Monitor",
  "Vendor / Section Status":"Delivery Vendor Status",
  "Delivery Challan Monitoring":"Delivery DC Monitor",
  "Delivered vs Pending":"Delivery Balance Monitor",
  "Delivery Delays":"Delivery Delay Monitor",
  "Reports":"Delivery Reports Monitor",
  "Vendor Registration":"Vendor Registration",
  "Completed Plans":"Delivery Plan Details",
  "Delivery Plan Entry":"Delivery Plan Details",
  "Section / Vendor Allocation":"Section Plan",
  "Delivery Challan Generate":"Section Plan",
  "Delivery Handover":"Delivery Handover Workspace",
  "Vendor Pending Qty":"Delivery Vendor Pending",
  "DC History":"Section History",
  "DC Print & Reports":"Section History",
 },
 STITCHING:{
  "Stitching Orders & Plans":"Stitching Orders Workspace",
  "Stitching Operation Progress":"Stitching Operation Workspace",
  "Line / Vendor Monitoring":"Stitching Vendor Workspace",
  "Target vs Actual":"Stitching Targets Workspace",
  "Bundle & WIP Status":"Stitching WIP Workspace",
  "Stitching Defects / Rework":"Stitching Defects Workspace",
  "Stitching Reports":"Stitching Reports Workspace",
  "Stitching Master / Operations":"Stitching Master Workspace",
  "Assigned Bundles / DC":"Stitching Assigned Workspace",
  "Operation Bulletin – View":"Stitching Bulletin Workspace",
  "Stitching Start / Update":"Stitching Start Workspace",
  "Operation-Wise Completion":"Stitching Completion Workspace",
  "Completed Stitching Qty":"Stitching Completed Workspace",
  "Rework / Defect Entry":"Stitching Rework Workspace",
  "Handover to Inward":"Stitching Handover Workspace",
  "Bundle QR / History":"Stitching Trace Workspace",
  "Print & Reports":"Stitching Reports Workspace",
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
