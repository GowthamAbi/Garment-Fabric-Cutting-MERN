import {DEPARTMENTS} from "../erp/departmentPolicy.js";
import Company from "../models/Company.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import AuditLog from "../models/AuditLog.js";
import GarmentMovement from "../models/GarmentMovement.js";
import TenantRegistry from "../models/TenantRegistry.js";
import { provisionTenant } from "../services/tenantProvisioningService.js";
import { assertStrongPassword } from "../utils/passwordPolicy.js";
import { runWithTenant } from "../utils/tenantContext.js";
import mongoose from "mongoose";
import SaasPlan from "../models/SaasPlan.js";
import {checkUserQuota} from "../utils/entitlementPolicy.js";

export async function getCompanies(request, response) {
  if (request.user.role === "saas_super_admin") {
    const tenants = await TenantRegistry.find()
      .select("companyKey companyName databaseName adminUserId adminName adminEmail activationEmailStatus activationEmailAt enabledDepartments loginPath status subscriptionPlan subscriptionEndsAt dataOwner ownerDataAccess retentionLock createdAt")
      .sort({ companyName: 1 })
      .lean();

    for (const row of tenants) {
      if (!row.adminUserId) {
        const admin = await runWithTenant(
          { companyKey: row.companyKey, databaseName: row.databaseName },
          () => User.findOne({ role: "company_admin" }).select("userId name email").lean(),
        );
        if (admin) {
          row.adminUserId = admin.userId;
          row.adminName = admin.name;
          row.adminEmail = admin.email;
        }
      }

      // The tenant database name is internal infrastructure and must not be exposed.
      delete row.databaseName;
    }

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
  if(String(request.params.id)!==String(request.user.companyId)) throw new ApiError(403,"Own company user management only");
  const session=await mongoose.startSession();let result;
  try{await session.withTransaction(async()=>{
    const company=await Company.findOneAndUpdate({_id:request.user.companyId},{$inc:{userProvisionRevision:1}},{new:true,session});
    const user=await User.findOne({_id:request.params.userId,companyId:request.user.companyId,factoryId:request.user.factoryId}).select("+sessionVersion").session(session);
    if(!company||!user||user.role==="saas_super_admin") throw new ApiError(404,"Company user not found");
    const nextActive=typeof request.body.active==="boolean"?request.body.active:user.active;
    const nextDepartment=request.body.department!==undefined?String(request.body.department):user.department;
    if(nextActive){
      const plan=company.entitlements?.maxUsers?company.entitlements:await SaasPlan.findOne({name:company.subscriptionPlan}).session(session).lean();
      const users=await User.collection.find({companyId:company._id,_id:{$ne:user._id},active:{$ne:false}},{session,projection:{department:1}}).limit(10001).toArray();
      checkUserQuota(plan,users,nextDepartment);
    }
    if(request.body.permissions&&(!Array.isArray(request.body.permissions)||request.body.permissions.some(p=>typeof p!=="string")))throw new ApiError(400,"Invalid permissions");
    if(request.body.role)user.role=request.body.role;user.active=nextActive;user.department=nextDepartment;
    if(request.body.permissions)user.permissions=request.body.permissions;
    user.sessionVersion=Number(user.sessionVersion||0)+1;await user.save({session});
    result={_id:user._id,name:user.name,email:user.email,role:user.role,department:user.department,permissions:user.permissions,active:user.active,factoryId:user.factoryId};
  });}finally{await session.endSession();}response.json(result);
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
  const validityDays=Number(request.body.validityDays||14);
  if(!Number.isInteger(validityDays)||validityDays<1||validityDays>366)throw new ApiError(400,"Validity must be 1–366 days");
  const selected=request.body.enabledDepartments||DEPARTMENTS;
  if(!Array.isArray(selected)||!selected.length||selected.some(d=>!DEPARTMENTS.includes(d))||new Set(selected).size!==selected.length)throw new ApiError(400,"Select unique supported departments");
  const selectedPlan=await SaasPlan.findOne({name:subscriptionPlan||"Trial",active:true}).lean();
  if(!selectedPlan)throw new ApiError(400,"Create/select an active subscription plan first");
  if(selected.length>selectedPlan.maxDepartments)throw new ApiError(400,"Selected departments exceed subscription limit");
  const licensed=selectedPlan.modules.filter(d=>DEPARTMENTS.includes(d));
  if(licensed.length&&selected.some(d=>!licensed.includes(d)))throw new ApiError(400,"Department is not included in this plan");
  const expiresAt = new Date(Date.now() + validityDays * 86400000);
  const provisioned = await provisionTenant({
    companyName, adminName, adminEmail, password: adminPassword,
    city: address, plan: subscriptionPlan || "Trial", expiresAt,factoryName,factoryCode:request.body.factoryCode,
    enabledDepartments:selected,entitlements:{maxUsers:selectedPlan.maxUsers,maxDepartments:selectedPlan.maxDepartments,modules:selectedPlan.modules},
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
    activationEmailStatus:provisioned.activationEmailStatus,
  });
}

export async function resendCompanyActivation(request,response){
 const registry=await TenantRegistry.findById(request.params.id);if(!registry||registry.status==='ARCHIVED')throw new ApiError(404,'Active company workspace not found');
 if(registry.activationEmailAt&&Date.now()-registry.activationEmailAt.getTime()<60000)throw new ApiError(429,'Wait one minute before resending activation');
 const {issueEmailVerification}=await import('../services/accountEmailService.js');
 try{await runWithTenant({companyKey:registry.companyKey,databaseName:registry.databaseName},async()=>{
  const user=await User.findOne({role:'company_admin',...(registry.adminUserId&&{userId:registry.adminUserId})});if(!user)throw new ApiError(404,'Administrator account missing');if(user.emailVerified)throw new ApiError(409,'Administrator email is already verified');
  await issueEmailVerification(user,registry.companyKey);registry.adminUserId=user.userId;registry.adminName=user.name;
 });registry.activationEmailStatus='ACCEPTED';registry.activationEmailAt=new Date();await registry.save();response.json({activationEmailStatus:'ACCEPTED',message:'Activation email accepted by provider'});
 }catch(error){if(error.statusCode!==409&&error.statusCode!==404){registry.activationEmailStatus='FAILED';await registry.save();}throw error;}
}
export async function configureCompanyDepartments(request,response){
 const selected=request.body.enabledDepartments;
 if(!Array.isArray(selected)||!selected.length||selected.some(d=>!DEPARTMENTS.includes(d))||new Set(selected).size!==selected.length)throw new ApiError(400,'Select unique supported departments');
 const registry=await TenantRegistry.findById(request.params.id);if(!registry)throw new ApiError(404,'Workspace not found');
 await runWithTenant({companyKey:registry.companyKey,databaseName:registry.databaseName},async()=>{
  const company=await Company.findOne();if(!company)throw new ApiError(404,'Company configuration missing');
  const plan=company.entitlements?.maxDepartments?company.entitlements:await SaasPlan.findOne({name:company.subscriptionPlan}).lean();
  if(!plan||selected.length>plan.maxDepartments)throw new ApiError(409,'Department selection exceeds plan limits');
  const licensed=(plan.modules||[]).filter(d=>DEPARTMENTS.includes(d));if(licensed.length&&selected.some(d=>!licensed.includes(d)))throw new ApiError(409,'Department not licensed');
  company.enabledDepartments=selected;await company.save();
 });registry.enabledDepartments=selected;await registry.save();response.json({enabledDepartments:selected});
}
export async function updateCompany(request, response) {
  if (request.user.role === "saas_super_admin")
    throw new ApiError(403, "Customer profile changes require the company administrator");
  const company = await Company.findByIdAndUpdate(
    request.params.id,
    Object.fromEntries(["companyName","logo","address","preferredLanguage","onboardingCompleted","privacyAcceptedAt"].filter(k=>request.body[k]!==undefined).map(k=>[k,request.body[k]])),
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
