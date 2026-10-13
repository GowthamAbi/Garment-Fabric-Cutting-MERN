import mongoose from "mongoose";
import TenantRegistry from "../models/TenantRegistry.js";
import User from "../models/User.js";
import Company from "../models/Company.js";
import { runWithTenant } from "../utils/tenantContext.js";
import { activationEmailConfiguration, issueEmailVerification } from "../services/accountEmailService.js";
import ApiError from "../utils/ApiError.js";

export function administratorEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (email.length > 160 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new ApiError(400, "Enter a valid administrator email");
  return email;
}
export async function editCompanyEmail(request, response) {
  const email = administratorEmail(request.body.email);
  activationEmailConfiguration();
  const session = await mongoose.startSession();
  let updated;
  try {
    await session.withTransaction(async () => {
      const registry = await TenantRegistry.findById(request.params.id).session(session);
      if (!registry || registry.status === "ARCHIVED") throw new ApiError(404, "Company not found");
      if (await TenantRegistry.exists({_id:{$ne:registry._id},adminEmail:email}).session(session)) throw new ApiError(409, "Email already belongs to another company");
      await runWithTenant({companyKey:registry.companyKey,databaseName:registry.databaseName}, async () => {
        const company = await Company.findOne().session(session);
        const user = await User.findOne(company?.ownerUserId ? {_id:company.ownerUserId} : {
          role:{$in:["company_owner","company_admin"]},...(registry.adminUserId && {userId:registry.adminUserId})
        }).select("+sessionVersion").session(session);
        if (!user) throw new ApiError(404, "Company administrator not found");
        if (user.email === email) throw new ApiError(409, "Email is unchanged");
        if (await User.exists({_id:{$ne:user._id},email}).session(session)) throw new ApiError(409, "Email already registered in this workspace");
        user.email=email; user.emailVerified=false; user.accountStatus="INVITED";
        user.sessionVersion=Number(user.sessionVersion || 0)+1;
        user.emailVerificationToken=undefined; user.emailVerificationExpires=undefined;
        user.resetPasswordToken=undefined; user.resetPasswordExpires=undefined;
        await user.save({session});
        registry.adminEmail=email; registry.adminUserId=user.userId;
        registry.activationEmailStatus="PENDING"; registry.activationEmailAt=undefined;
        await registry.save({session});
        updated={companyKey:registry.companyKey,databaseName:registry.databaseName,id:registry._id,userId:user._id};
      });
    });
  } catch(error) {
    if(error.code===11000) throw new ApiError(409,"Administrator email already registered");
    throw error;
  } finally {await session.endSession();}
  let status="ACCEPTED";
  try {await runWithTenant(updated,async()=>issueEmailVerification(await User.findById(updated.userId),updated.companyKey));}
  catch {status="FAILED";}
  await TenantRegistry.updateOne({_id:updated.id,adminEmail:email},{$set:{activationEmailStatus:status,activationEmailAt:new Date()}});
  response.json({adminEmail:email,activationEmailStatus:status,message:status==="ACCEPTED"?"Email updated. Previous sessions revoked; verify the new activation email.":"Email updated and previous sessions revoked. Activation delivery failed; use Resend email."});
}
