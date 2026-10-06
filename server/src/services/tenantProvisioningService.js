import bcrypt from "bcryptjs";
import TenantRegistry from "../models/TenantRegistry.js";
import Company from "../models/Company.js";
import User from "../models/User.js";
import { runWithTenant } from "../utils/tenantContext.js";
import { sanitizeTenantKey, tenantDatabaseName } from "../config/tenantDatabase.js";
import { generateUserId } from "../utils/generateUserId.js";
import { issueEmailVerification } from "./accountEmailService.js";

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
  plan = "Trial", expiresAt, createdBy = "Platform",
}) {
  const companyKey = await availableCompanyKey(companyName);
  const databaseName = tenantDatabaseName(companyKey);
  const registry = await TenantRegistry.create({
    companyKey, companyName, databaseName,
    loginPath: `/c/${companyKey}/login`,
    status: "PROVISIONING", subscriptionPlan: plan,
    subscriptionEndsAt: expiresAt, createdBy,
  });

  try {
    const result = await runWithTenant(
      { companyKey, databaseName, tenantRegistryId: registry._id },
      async () => {
        const company = await Company.create({
          companyName, address: city, subscriptionPlan: plan,
          subscriptionStatus: "Active", subscriptionStartsAt: new Date(),
          subscriptionEndsAt: expiresAt,
          factories: [{ name: `${companyName} Main`, code: "MAIN", address: city }],
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
        const activationUrl = await issueEmailVerification(user, companyKey);
        return { company, userId, userEmail: user.email, activationUrl };
      },
    );
    registry.status = "ACTIVE";
    await registry.save();
    return { registry, ...result };
  } catch (error) {
    registry.status = "ARCHIVED";
    await registry.save();
    throw error;
  }
}
