import mongoose from "mongoose";
import Company from "../models/Company.js";
import TenantRegistry from "../models/TenantRegistry.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";
import {getTenant,runWithTenant} from "../utils/tenantContext.js";
import {trialEligible} from "../utils/trialPolicy.js";
import {trialExpiry} from "../utils/subscriptionAccess.js";
import {departmentSelection} from "../../../shared/departmentCatalogue.js";
import ApiError from "../utils/ApiError.js";

export async function startCompanyTrial(request,response){
  if(!["company_owner","company_admin"].includes(request.user.role))throw new ApiError(403,"Only a company administrator can start the trial");
  const tenant=getTenant();
  if(tenant.factoryId)return runWithTenant({...tenant,factoryId:undefined},()=>startCompanyTrial(request,response));
  const session=await mongoose.startSession();
  let expiresAt;
  try{await session.withTransaction(async()=>{
    const registry=await TenantRegistry.findOne({companyKey:tenant.companyKey}).session(session);
    const company=await Company.findById(request.user.companyId).session(session);
    const hasPaid=await SubscriptionPayment.exists({companyId:request.user.companyId,status:{$in:["PAID","REFUNDED"]}}).session(session);
    if(!trialEligible(company,registry,hasPaid))throw new ApiError(409,"The free trial has already been used or this company is not eligible");
    const departments=departmentSelection(company.enabledDepartments);
    const now=new Date();expiresAt=trialExpiry(now.getTime());
    // Both records are written in the transaction so concurrent starts cannot extend the trial.
    company.trialUpgradePlan=company.subscriptionPlan;
    company.trialStartedAt=now;company.subscriptionPlan="Trial";company.subscriptionStatus="Active";
    company.subscriptionStartsAt=now;company.subscriptionEndsAt=expiresAt;
    company.entitlements={maxUsers:15,maxDepartments:14,modules:[...departments,"ERP_CORE"]};
    registry.trialStartedAt=now;registry.trialEndsAt=expiresAt;
    registry.subscriptionPlan="Trial";registry.subscriptionEndsAt=expiresAt;registry.status="ACTIVE";
    await company.save({session});await registry.save({session});
  });}finally{await session.endSession();}
  response.json({message:"14-day trial activated",expiresAt});
}
