import {request} from "./axiosInstance.js";
const base="/erp/departments";const post=(p,v)=>request(base+p,{method:"POST",body:JSON.stringify(v)});
export const getMarketingOverview=()=>request(base+"/marketing/overview");
export const getMarketingForecast=({days=30,leadDays=14,serviceLevel=95,method="forecast"}={})=>
 request(base+"/marketing/analysis?"+new URLSearchParams({days,leadDays,serviceLevel,method}).toString());
export const createMarketingLead=body=>post("/marketing/leads",body);
export const updateMarketingLeadStatus=(leadId,body)=>post("/marketing/leads/"+encodeURIComponent(leadId)+"/status",body);
export const createMarketingActivity=body=>post("/marketing/activities",body);
export const createMarketingCampaign=body=>post("/marketing/campaigns",body);
export const createMarketingExpense=body=>post("/marketing/expenses",body);
export const createMarketingDemand=body=>post("/demands",body);
