// Exact Book1.xlsx management-workflow audit. These are PAGE CANDIDATES,
// not evidence a feature is complete or authorized in real tenant staging.
import {EXCEL_REQUIREMENTS} from "../../../shared/excelRequirementCatalogue.js";
const managementAreas=new Set(["Company Admin","Factory Manager"]);
export const MANAGEMENT_REQUIREMENTS=Object.freeze(EXCEL_REQUIREMENTS.filter(x=>managementAreas.has(x.area)));
const match=(label,pattern)=>pattern.test(label);
export function managementAuditCategory(label){
 if(match(label,/approvals?|authorization|permissions?|roles?|create user|deactivate user|create department|security/i))return "ACCESS_AND_APPROVAL";
 if(match(label,/wages?|margin|expenses?|invoices?|billing|payments?|cost|purchase orders?|purchases?/i))return "FINANCE_AND_PURCHASE";
 if(match(label,/stock|warehouse|material|trims?|fabric|shop|consumption|availability/i))return "INVENTORY_AND_STOCK";
 if(match(label,/delays?|alerts?|notifications?|escalation|due dates?|follow.?up/i))return "ALERTS_AND_SLA";
 if(match(label,/production|orders?|cutting|stitching|inward|checking|ironing|packing|dispatch|delivery|quality|rejection|rework|efficiency|wip|department/i))return "PRODUCTION_AND_TRACE";
 return "ADMIN_SERVICE_AND_REPORT";
}
export function managementCandidatePage(record){
 const l=record.label;
 if(/approvals?|approval history/i.test(l))return "Management Approval Inbox";
 if(/create user|assign role|edit \/ deactivate user|permissions|department heads/i.test(l))return "User Management";
 if(/purchase orders/i.test(l))return "Company Purchase Orders";
 if(/current plan|upgrade plan|billing management|invoice history/i.test(l))return "Subscription Purchase";
 if(/shop stock|shop sales|shop transfers/i.test(l))return "Shop Management";
 if(/warehouse stock|pending.*warehouse/i.test(l))return "Warehouse Management";
 if(/\bfabric\b/i.test(l))return "Fabric Dashboard";
 if(/\bcutting\b/i.test(l))return "Cutting Dashboard";
 if(/\belastic\b/i.test(l))return "Elastic Dashboard";
 if(/\baccessories\b|\btrims\b/i.test(l))return "Accessories Dashboard";
 if(/\bdispatch\b/i.test(l))return "Dispatch Ready Workspace";
 if(/\bchecking\b/i.test(l))return "Checking Plans Workspace";
 if(/\bironing\b/i.test(l))return "Ironing Queue Workspace";
 if(/\bpacking\b/i.test(l))return "Packing Plan Overview Workspace";
 if(/\bstitching\b/i.test(l))return "Stitching Orders Workspace";
 if(/department.*task|task follow.?up/i.test(l))return "Department Tasks";
 if(/payment|receivables?|payables?|expense|material issue|ledger|cash|bank|wages?|sales margin|\bcost\b/i.test(l))return "Integrated ERP";
 if(/production|orders?|delivery schedule|efficiency|wip/i.test(l))return "Production Dashboard";
 if(/business overview|todays? sales|stock overview/i.test(l))return "Company Dashboard";
 return null; // No safe page identity guessed for support/security/notifications
}
export function managementAuditEntry(item){
 if(!managementAreas.has(item.area))return null;
 const category=managementAuditCategory(item.label);
 const priority=["ACCESS_AND_APPROVAL","FINANCE_AND_PURCHASE","INVENTORY_AND_STOCK"].includes(category)?"P0":
  category==="ADMIN_SERVICE_AND_REPORT"?"P2":"P1";
 return {id:item.id,area:item.area,label:item.label,category,priority,
  candidatePage:managementCandidatePage(item),
  evidence:"NAVIGATION_CANDIDATE_ONLY",
  acceptance:"UNVERIFIED",sourceStatus:item.status};
}
export const MANAGEMENT_GAP_REGISTER=Object.freeze(MANAGEMENT_REQUIREMENTS.map(managementAuditEntry));
