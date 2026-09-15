import bcrypt from "bcryptjs";
import Company from "../models/Company.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import AuditLog from "../models/AuditLog.js";
import GarmentMovement from "../models/GarmentMovement.js";

export async function getCompanies(_request, response) {
  const companies = await Company.find().sort({ companyName: 1 }).lean();
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
  if (await User.exists({ email: adminEmail.toLowerCase() }))
    throw new ApiError(409, "Email already registered");
  const company = await Company.create({
    companyName,
    address,
    subscriptionPlan,
    subscriptionStartsAt: new Date(),
    subscriptionEndsAt: new Date(Date.now() + 14 * 86400000),
    factories: [
      { name: factoryName, code: request.body.factoryCode || "MAIN", address },
    ],
  });
  const factoryId = company.factories[0]._id;
  const user = await User.create({
    name: adminName,
    email: adminEmail,
    password: await bcrypt.hash(adminPassword, 12),
    role: "company_admin",
    companyId: company._id,
    factoryId,
  });
  response.status(201).json({
    company,
    admin: { _id: user._id, name: user.name, email: user.email },
  });
}

export async function updateCompany(request, response) {
  const company = await Company.findByIdAndUpdate(
    request.params.id,
    request.body,
    { new: true, runValidators: true },
  );
  if (!company) throw new ApiError(404, "Company not found");
  response.json(company);
}
