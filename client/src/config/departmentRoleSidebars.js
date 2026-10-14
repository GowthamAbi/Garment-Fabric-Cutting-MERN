// Phase 1: reusable navigation configuration. This module does not grant API access.
// Existing Fabric, Cutting, Accessories, Elastic and Delivery navigation stays unchanged
// until each screen has been checked against its backend permissions.
import { DEPARTMENTS, departmentCode } from "../../../../shared/departmentCatalogue.js";

export const PROPOSED_DEPARTMENTS = Object.freeze([...DEPARTMENTS, "HR", "ACCOUNTS"]);
export const NOT_YET_LICENSED = Object.freeze(["HR", "ACCOUNTS"]);
export const WORKSPACE_ROLES = Object.freeze({ HEAD: "HEAD", STAFF: "STAFF" });

const commonHead = Object.freeze([
  ["Dashboard", "overview"],
  ["Plans & Assigned Orders", "read"],
  ["Work Progress & Pending", "read"],
  ["Approval Inbox", "approve"],
  ["Team & Follow-Ups", "read"],
  ["Reports & History", "read"],
  ["Notifications", "read"]
]);
const commonStaff = Object.freeze([
  ["Dashboard", "overview"],
  ["Assigned Work", "read"],
  ["Daily Entries", "write"],
  ["Pending Work", "read"],
  ["Correction Requests", "request"],
  ["History & Print", "read"]
]);
const process = Object.freeze({
 FABRIC:["Inward & Roll Status","Folding / Fabric Issue","Stock & Shortage"],
 CUTTING:["Machine / Cutting Plan","Target vs Actual","Waste & Recut"],
 ACCESSORIES:["Before / After Sewing","Trims Availability","Material Issues"],
 ELASTIC:["Elastic Cutting Plan","Balance & Issue","Elastic Shortage"],
 DELIVERY:["Vendor / Section DC","Delivered vs Pending","Vendor Handover"],
 STITCHING:["Operation Bulletin & SAM","Bundle / Line Progress","Rework & Vendor Pending"],
 INWARD:["Expected Stitching DC","Received vs Sent","Short / Excess Inward"],
 CHECKING:["Pass / Reject / Rework","Defect / Oil Removal","Quality Hold"],
 IRONING:["Ironing Queue","Completed / Re-Iron","Transfer to Packing"],
 PACKING:["Ready / Packed Quantity","Material & Carton Status","Repacking"],
 DISPATCH:["Ready / Pending Dispatch","Transport & DC","Transit Status"],
 WAREHOUSE:["Inbound / Outbound","Stock & Transfers","Shortage / Variance"],
 SHOP:["Sales & Returns","Stock & Transfers","Payment Overview"],
 MARKETING:["Customer / Lead Follow-Up","Demand Requests","Sales Forecast"],
 HR:["Attendance & Leave","Staff & Shift","Payroll Review"],
 ACCOUNTS:["Payables & Receivables","Expenses & Payments","Bank Reconciliation"]
});

export function getDepartmentSidebar(department, role, options = {}) {
 const code = departmentCode(department);
 if (!PROPOSED_DEPARTMENTS.includes(code)) return [];
 if (NOT_YET_LICENSED.includes(code) && !options.experimentalDepartments) return [];
 if (options.enabledDepartments && !options.enabledDepartments.map(departmentCode).includes(code)) return [];
 const kind = String(role || "").toUpperCase();
 if (![WORKSPACE_ROLES.HEAD, WORKSPACE_ROLES.STAFF].includes(kind)) return [];
 const base = kind === "HEAD" ? commonHead : commonStaff;
 const detail = process[code].map(label => [label, kind === "HEAD" ? "read" : "read"]);
 return [...base.slice(0, 3), ...detail, ...base.slice(3)].map(([label,action],index)=>({
   id: `${code.toLowerCase()}-${kind.toLowerCase()}-${index}`,
   label, action, department:code,
   // Display metadata only: the server MUST enforce company/factory/department
   // grants and approval limits independently of the menu.
   requiresServerAuthorization:true
 }));
}
export function isDepartmentWorkspaceReady(department) {
 const code=departmentCode(department);
 return DEPARTMENTS.includes(code);
}
