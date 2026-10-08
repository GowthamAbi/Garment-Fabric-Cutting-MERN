import bcrypt from "bcryptjs";
import TenantRegistry from "../models/TenantRegistry.js";
import Company from "../models/Company.js";
import User from "../models/User.js";
import { runWithTenant } from "../utils/tenantContext.js";
import { sanitizeTenantKey, tenantDatabaseName } from "../config/tenantDatabase.js";
import { generateUserId } from "../utils/generateUserId.js";
import { issueEmailVerification,activationEmailConfiguration } from "./accountEmailService.js";
import ApiError from '../utils/ApiError.js';

async function availableCompanyKey(companyName) {
  const base = sanitizeTenantKey(companyName).slice(0, 32);
  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const key = suffix ? `${base}-${suffix + 1}` : base;
    if (!(await TenantRegistry.exists({ companyKey: key }))) return key;
  }
  throw new Error("Unable to generate company workspace key");
}

export async function provisionTenant({
  companyName, adminName, adminEmail, password, passwordHash, city = "",
  plan = "Trial", expiresAt, createdBy = "Platform", enabledDepartments=[],entitlements, factoryName,factoryCode,
}) {
  activationEmailConfiguration();
  adminEmail=String(adminEmail||'').trim().toLowerCase();
  if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(adminEmail))throw new ApiError(400,'Valid administrator email required');
  await TenantRegistry.init();
  if(await TenantRegistry.exists({adminEmail}))throw new ApiError(409,'This administrator email already has a company account. Use the existing company or resend activation.');
  // Older registries did not store admin email. Inspect account metadata only.
  const older=await TenantRegistry.find({adminEmail:{$exists:false}}).select('companyKey databaseName').limit(1001).lean();
  if(older.length>1000)throw new ApiError(409,'Backfill legacy administrator metadata before provisioning more companies');
  for(const row of older){const found=await runWithTenant({companyKey:row.companyKey,databaseName:row.databaseName},()=>User.exists({role:'company_admin',email:adminEmail}));if(found)throw new ApiError(409,'This administrator email already belongs to an existing company');}
  const companyKey = await availableCompanyKey(companyName);
  const databaseName = tenantDatabaseName(companyKey);
  const registry = await TenantRegistry.create({
    companyKey, companyName, databaseName,enabledDepartments,adminEmail,adminName,
    loginPath: `/c/${companyKey}/login`,
    status: "PROVISIONING", subscriptionPlan: plan,
    subscriptionEndsAt: expiresAt, createdBy,
  }).catch(error=>{if(error.code===11000)throw new ApiError(409,"Administrator email or company workspace already exists; refresh the companies list");throw error;});

  try {
    const result = await runWithTenant(
      { companyKey, databaseName, tenantRegistryId: registry._id },
      async () => {
        const company = await Company.create({
          companyName, address: city, subscriptionPlan: plan,enabledDepartments,entitlements,
          subscriptionStatus: "Active", subscriptionStartsAt: new Date(),
          subscriptionEndsAt: expiresAt,
          factories: [{ name: factoryName||`${companyName} Main`, code: factoryCode||"MAIN", address: city }],
        });
        const userId = await generateUserId({ name: adminName, department: "MANAGEMENT", role: "company_admin" });
        const user = await User.create({
          userId, name: adminName, email: String(adminEmail).toLowerCase(),
          emailVerified: false,
          accountStatus: "INVITED",
          password: passwordHash || await bcrypt.hash(password, 12),
          role: "company_admin", companyId: company._id,
          factoryId: company.factories[0]._id,
        });
        let activationUrl,activationEmailStatus='ACCEPTED';
        try{activationUrl=await issueEmailVerification(user,companyKey);}catch{activationEmailStatus='FAILED';}
        return { company, userId, userEmail: user.email, activationUrl,activationEmailStatus };
      },
    );
    registry.status = "ACTIVE";
    registry.adminUserId=result.userId;
    registry.activationEmailStatus=result.activationEmailStatus;
    if(result.activationEmailStatus==='ACCEPTED')registry.activationEmailAt=new Date();
    await registry.save();
    return { registry, ...result };
  } catch (error) {
    registry.status = "ARCHIVED";
    await registry.save();
    throw error;
  }
}
