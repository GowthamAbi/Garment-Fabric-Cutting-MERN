import Company from "../models/Company.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import AuditLog from "../models/AuditLog.js";
import GarmentMovement from "../models/GarmentMovement.js";
import TenantRegistry from "../models/TenantRegistry.js";
import { provisionTenant } from "../services/tenantProvisioningService.js";
import { assertStrongPassword } from "../utils/passwordPolicy.js";
import { runWithTenant } from "../utils/tenantContext.js";

export async function getCompanies(request, response) {
  if (request.user.role === "saas_super_admin") {
    const tenants = await TenantRegistry.find()
      .select("companyKey companyName loginPath status subscriptionPlan subscriptionEndsAt dataOwner ownerDataAccess retentionLock createdAt")
      .sort({ companyName: 1 })
      .lean();
    return response.json(tenants);
  }
  const companies = await Company.find(
    request.user.role === "saas_super_admin"
      ? {}
      : { _id: request.user.companyId },
  )
    .sort({ companyName: 1 })
    .lean();
  const rows = await Promise.all(
    companies.map(async (company) => ({
      ...company,
      userCount: await User.countDocuments({ companyId: company._id }),
      activeUsers: await User.countDocuments({
        companyId: company._id,
        active: true,
      }),
    })),
  );
  response.json(rows);
}

export async function getCompanyWorkspace(request, response) {
  if (request.user.role === "saas_super_admin")
    throw new ApiError(403, "Customer production data is private. Owner access requires a customer-issued support grant");
  const company = await Company.findById(request.params.id).lean();
  if (!company) throw new ApiError(404, "Company not found");
  const users = await User.find({ companyId: company._id })
    .select("name email role department permissions active factoryId createdAt")
    .sort({ role: 1, name: 1 })
    .lean();
  const departments = {
    Administration: users.filter((user) =>
      ["company_admin", "admin", "management", "view_only"].includes(user.role),
    ),
    Store: users.filter((user) => user.role === "store"),
    "Fabric Store": users.filter((user) =>
      ["fabric_admin", "fabric_entry"].includes(user.role),
    ),
    Cutting: users.filter((user) =>
      ["cutting_admin", "cutting_entry"].includes(user.role),
    ),
    "Accessories Store": users.filter((user) =>
      ["store", "accessories_admin", "accessories_entry"].includes(user.role),
    ),
    "Elastic Production": users.filter((user) =>
      [
        "production",
        "production_planner",
        "production_operator",
        "supervisor",
        "quality",
        "maintenance",
        "elastic_admin",
        "elastic_entry",
      ].includes(user.role),
    ),
    "Stitching / Swing": users.filter((user) =>
      ["sewing_coordinator", "stitching_admin", "stitching_entry"].includes(
        user.role,
      ),
    ),
  };
  const movementTotals = await GarmentMovement.aggregate([
    { $match: { companyId: company._id } },
    {
      $group: {
        _id: "$department",
        quantity: { $sum: "$quantity" },
        entries: { $sum: 1 },
      },
    },
  ]);
  const recentActivity = await AuditLog.find({ companyId: company._id })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();
  response.json({
    company,
    departments,
    users,
    departmentActivity: movementTotals.map((row) => ({
      department: row._id,
      quantity: row.quantity,
      entries: row.entries,
    })),
    recentActivity,
  });
}

export async function updateCompanyUser(request, response) {
  if (request.user.role === "saas_super_admin")
    throw new ApiError(403, "The company administrator must manage company users");
  const allowedRoles = [
    "company_admin",
    "admin",
    "store",
    "production",
    "production_planner",
    "production_operator",
    "supervisor",
    "quality",
    "maintenance",
    "sewing_coordinator",
    "fabric_admin",
    "fabric_entry",
    "cutting_admin",
    "cutting_entry",
    "accessories_admin",
    "accessories_entry",
    "elastic_admin",
    "elastic_entry",
    "stitching_admin",
    "stitching_entry",
    "delivery_admin",
    "delivery_entry",
    "management",
    "view_only",
    "department_incharge",
    "department_entry",
  ];
  if (request.body.role && !allowedRoles.includes(request.body.role))
    throw new ApiError(400, "Invalid company role");
  const user = await User.findOneAndUpdate(
    { _id: request.params.userId, companyId: request.params.id },
    {
      ...(request.body.role && { role: request.body.role }),
      ...(typeof request.body.active === "boolean" && {
        active: request.body.active,
      }),
      ...(request.body.permissions && {
        permissions: request.body.permissions,
      }),
      ...(request.body.department !== undefined && {
        department: request.body.department,
      }),
    },
    { new: true, runValidators: true },
  ).select("name email role permissions active factoryId createdAt");
  if (!user) throw new ApiError(404, "Company user not found");
  response.json(user);
}

export async function createCompany(request, response) {
  const {
    companyName,
    factoryName,
    address,
    subscriptionPlan,
    adminName,
    adminEmail,
    adminPassword,
  } = request.body;
  if (
    !companyName ||
    !factoryName ||
    !adminName ||
    !adminEmail ||
    !adminPassword
  ) {
    throw new ApiError(
      400,
      "Company, factory and administrator details are required",
    );
  }
  assertStrongPassword(adminPassword, { name: adminName, email: adminEmail });
  const expiresAt = new Date(Date.now() + Number(request.body.validityDays || 14) * 86400000);
  const provisioned = await provisionTenant({
    companyName, adminName, adminEmail, password: adminPassword,
    city: address, plan: subscriptionPlan || "Trial", expiresAt,
    createdBy: request.user.userId || request.user.name,
  });
  response.status(201).json({
    company: {
      companyName,
      companyKey: provisioned.registry.companyKey,
      loginPath: provisioned.registry.loginPath,
      databaseName: provisioned.registry.databaseName,
      subscriptionPlan: provisioned.registry.subscriptionPlan,
    },
    admin: { userId: provisioned.userId, name: adminName, email: provisioned.userEmail },
  });
}

export async function updateCompany(request, response) {
  if (request.user.role === "saas_super_admin")
    throw new ApiError(403, "Customer profile changes require the company administrator");
  const company = await Company.findByIdAndUpdate(
    request.params.id,
    request.body,
    { new: true, runValidators: true },
  );
  if (!company) throw new ApiError(404, "Company not found");
  response.json(company);
}

export async function controlCompanySubscription(request, response) {
  const action = String(request.body.action || "").toUpperCase();
  const updates = {
    ACTIVATE: { subscriptionStatus: "Active", active: true },
    PAUSE: { subscriptionStatus: "Suspended" },
    REVOKE: { subscriptionStatus: "Expired", active: false },
    ARCHIVE: { subscriptionStatus: "Expired", active: false },
  }[action];
  if (!updates)
    throw new ApiError(
      400,
      "Action must be ACTIVATE, PAUSE, REVOKE or ARCHIVE",
    );
  if (action === "ACTIVATE" && request.body.validityDays)
    updates.subscriptionEndsAt = new Date(
      Date.now() + Number(request.body.validityDays) * 86400000,
    );
  const registry = await TenantRegistry.findById(request.params.id);
  if (!registry) throw new ApiError(404, "Company workspace not found");
  registry.status = action === "ACTIVATE" ? "ACTIVE" : action === "PAUSE" ? "SUSPENDED" : "ARCHIVED";
  if (updates.subscriptionEndsAt) registry.subscriptionEndsAt = updates.subscriptionEndsAt;
  await registry.save();
  await runWithTenant(
    { companyKey: registry.companyKey, databaseName: registry.databaseName },
    async () => {
      const company = await Company.findOne();
      if (company) {
        Object.assign(company, updates);
        await company.save();
      }
    },
  );
  response.json({
    _id: registry._id,
    companyName: registry.companyName,
    companyKey: registry.companyKey,
    status: registry.status,
    subscriptionEndsAt: registry.subscriptionEndsAt,
  });
}
