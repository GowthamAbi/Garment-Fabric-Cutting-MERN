import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import crypto from "node:crypto";
import Company from "../models/Company.js";
import { clearLoginAttempts } from "../middleware/securityMiddleware.js";
import { getTenant } from "../utils/tenantContext.js";
import { assertStrongPassword } from "../utils/passwordPolicy.js";
import { generateUserId } from "../utils/generateUserId.js";
import { issueEmailVerification } from "../services/accountEmailService.js";
import mongoose from "mongoose";
import SaasPlan from "../models/SaasPlan.js";
import { checkUserQuota } from "../utils/entitlementPolicy.js";

function createToken(user) {
  const tenant = getTenant();
  return jwt.sign(
    {
      id: user._id,
      userId: user.userId,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      factoryId: user.factoryId,
      permissions: user.permissions,
      department: user.department,
      sessionVersion: Number(user.sessionVersion || 0),
      companyKey: tenant.companyKey || "platform",
      databaseName: tenant.databaseName || process.env.CONTROL_DB_NAME || "ugs_control",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "8h",
      issuer: "ug-saas-api",
      audience: "ug-saas-web",
    },
  );
}

function sessionCookieName() {
  return process.env.NODE_ENV === "production"
    ? "__Host-ug_session"
    : "ug_session";
}

function sessionCookieOptions() {
  const production = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? "none" : "lax",
    partitioned: production,
    path: "/",
    maxAge: 8 * 60 * 60 * 1000,
  };
}

function createUserResponse(user, companyName = "UG SaaS") {
  const tenant = getTenant();
  return {
    user: {
      _id: user._id,
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      factoryId: user.factoryId,
      permissions: user.permissions || [],
      department: user.department || "",
      companyName,
      companyKey: tenant.companyKey || "platform",
      loginPath: tenant.companyKey && tenant.companyKey !== "platform"
        ? `/c/${tenant.companyKey}/login`
        : "/login",
    },
  };
}

function startSession(response, user, companyName) {
  response.cookie(
    sessionCookieName(),
    createToken(user),
    sessionCookieOptions(),
  );
  return createUserResponse(user, companyName);
}

export async function getSetupStatus(_request, response) {
  response.json({ setupRequired: (await User.countDocuments()) === 0 });
}

export async function register(_request, _response) {
  throw new ApiError(403, "Public owner registration is disabled. Run the private owner bootstrap command.");
}

export async function getUsers(_request, response) {
  response.json(
    await User.find()
      .select(
        "userId name email emailVerified role department permissions active accountStatus companyId factoryId createdAt lastLoginAt",
      )
      .sort({ createdAt: 1 }),
  );
}

export async function createUser(request, response) {
  const { name, email, password, role } = request.body;
  const allowedRoles = [
    "company_admin",
    "admin",
    "store",
    "production_planner",
    "production_operator",
    "production",
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
  if (!name || !email || !password || !allowedRoles.includes(role)) {
    throw new ApiError(
      400,
      "Name, email, password and a valid role are required",
    );
  }
  assertStrongPassword(password, { name, email });
  if (await User.exists({ email: email.toLowerCase() }))
    throw new ApiError(409, "Email already registered");
  const targetCompanyId =
    request.user.role === "saas_super_admin"
      ? request.body.companyId || request.user.companyId
      : request.user.companyId;
  const targetFactoryId =
    request.user.role === "saas_super_admin"
      ? request.body.factoryId || request.user.factoryId
      : request.user.factoryId;
  const userId = await generateUserId({ name, department: request.body.department, role });
  const userData = {
    userId,
    name,
    email,
    password: await bcrypt.hash(password, 12),
    role,
    emailVerified: false,
    accountStatus: "INVITED",
    permissions: request.body.permissions || [],
    department: request.body.department || "",
    companyId: targetCompanyId,
    factoryId: targetFactoryId,
  };
  let user;
  if(request.user.role==="saas_super_admin") user=await User.create(userData);
  else {
    await User.init();await Company.init();
    const session=await mongoose.startSession();
    try { await session.withTransaction(async()=>{
      const company=await Company.findOneAndUpdate({_id:targetCompanyId},{$inc:{userProvisionRevision:1}},{new:true,session});
      if(!company) throw new ApiError(409,"Company is unavailable");
      const plan=company.entitlements?.maxUsers?company.entitlements:await SaasPlan.findOne({name:company.subscriptionPlan}).session(session).lean();
      const users=await User.collection.find({companyId:new mongoose.Types.ObjectId(targetCompanyId),active:{$ne:false}},{session,projection:{department:1}}).limit(10001).toArray();
      checkUserQuota(plan,users,userData.department);
      [user]=await User.create([userData],{session});
    }); } finally {await session.endSession();}
  }
  const activationUrl = await issueEmailVerification(user, getTenant().companyKey);
  response.status(201).json({
    _id: user._id,
    userId: user.userId,
    name: user.name,
    email: user.email,
    role: user.role,
    message: "User created. Activation link sent to the registered email.",
    ...(process.env.NODE_ENV !== "production" && { activationUrl }),
  });
}

export async function verifyEmail(request, response) {
  const token = String(request.body.token || "");
  if (!token) throw new ApiError(400, "Verification token is required");
  const hashed = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    emailVerificationToken: hashed,
    emailVerificationExpires: { $gt: new Date() },
  }).select("+emailVerificationToken");
  if (!user) throw new ApiError(400, "Verification link is invalid or expired");
  user.emailVerified = true;
  user.accountStatus = "ACTIVE";
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();
  response.json({ message: "Email verified. You can now login with your User ID." });
}

export async function forgotPassword(request, response) {
  const identifier = String(request.body.userId || request.body.email || "").trim();
  if (!identifier) throw new ApiError(400, "User ID is required");
  const user = await User.findOne(
    identifier.includes("@")
      ? { email: identifier.toLowerCase() }
      : { userId: identifier.toUpperCase() },
  );
  if (!user) {
    return response.json({
      message: "If the email exists, a reset link has been created",
    });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();

  const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")[0]
    .replace(/\/$/, "");
  const companyKey = getTenant().companyKey || "platform";
  const resetUrl = `${clientUrl}/c/${companyKey}/login?resetToken=${rawToken}`;

  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [user.email],
        subject: "UG SaaS password reset",
        html: `<p>Use this one-time link within 15 minutes:</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, contact your administrator.</p>`,
      }),
    });
  }

  response.json({
    message: "Password reset link created. Check your email.",
    ...(process.env.NODE_ENV !== "production" && { resetUrl }),
  });
}

export async function resetPassword(request, response) {
  const { token, password } = request.body;
  if (!token || !password) throw new ApiError(400, "Valid token and password are required");
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: new Date() },
  });
  if (!user) throw new ApiError(400, "Reset link is invalid or expired");
  assertStrongPassword(password, user);
  for (const previous of user.passwordHistory?.slice(-5) || []) {
    if (await bcrypt.compare(password, previous.hash))
      throw new ApiError(400, "You cannot reuse one of your last five passwords");
  }
  user.passwordHistory = [
    ...(user.passwordHistory || []).slice(-4),
    { hash: user.password, changedAt: new Date() },
  ];
  user.password = await bcrypt.hash(password, 12);
  user.passwordChangedAt = new Date();
  user.sessionVersion = Number(user.sessionVersion || 0) + 1;
  user.resetPasswordToken = "";
  user.resetPasswordExpires = undefined;
  await user.save();
  response.json({ message: "Password reset successfully" });
}

export async function login(request, response) {
  const userId = String(request.body.userId || "").trim().toUpperCase();
  if (!userId) throw new ApiError(400, "Company and User ID are required");
  const user = await User.findOne({
    userId,
  }).select("+sessionVersion +failedLoginCount +lockedUntil");
  if (user?.lockedUntil && user.lockedUntil > new Date())
    throw new ApiError(423, "Account is temporarily locked. Try again later or reset your password");
  const validPassword =
    user && (await bcrypt.compare(request.body.password || "", user.password));

  if (!validPassword) {
    if (user) {
      user.failedLoginCount = Number(user.failedLoginCount || 0) + 1;
      if (user.failedLoginCount >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.accountStatus = "LOCKED";
      }
      await user.save();
    }
    throw new ApiError(401, "Incorrect Company, User ID or password");
  }
  if (!user.active) throw new ApiError(403, "This user account is disabled");
  if (!user.emailVerified && user.role !== "saas_super_admin")
    throw new ApiError(403, "Verify your registered email before login");
  const company = await Company.findById(user.companyId).lean();
  if (user.role !== "saas_super_admin") {
    if (!company?.active) throw new ApiError(403, "Company account is inactive");
    // Expired companies may sign in to billing. Operational routes remain subscription-gated.
  }
  clearLoginAttempts(request);
  user.failedLoginCount = 0;
  user.lockedUntil = undefined;
  user.accountStatus = "ACTIVE";
  user.lastLoginAt = new Date();
  await user.save();
  response.json(startSession(response, user, company?.companyName));
}

export async function getSession(request, response) {
  const user = await User.findById(request.user.id)
    .select("userId name email emailVerified role department permissions active companyId factoryId")
    .lean();
  if (!user?.active) throw new ApiError(401, "Session is no longer active");

  const company = await Company.findById(user.companyId)
    .select("companyName active subscriptionStatus subscriptionEndsAt")
    .lean();

  response.json(createUserResponse(user, company?.companyName));
}

export async function logout(request, response) {
  await User.findByIdAndUpdate(request.user.id, {
    $inc: { sessionVersion: 1 },
  });
  response.clearCookie(sessionCookieName(), sessionCookieOptions());
  response.status(204).end();
}

export async function getProfile(request, response) {
  const user = await User.findById(request.user.id)
    .select(
      "userId name email emailVerified role department permissions active accountStatus companyId factoryId createdAt lastLoginAt",
    )
    .lean();
  if (!user) throw new ApiError(404, "Profile not found");
  response.json(user);
}
export async function updateUserPermissions(request, response) {
  const allowed = ["department.stitching.read","department.stitching.write","department.inward.read","department.inward.write","department.checking.read","department.checking.write","department.ironing.read","department.ironing.write","department.packing.read","department.packing.write","department.dispatch.read","department.dispatch.write","department.warehouse.read","department.warehouse.write","department.shop.read","department.shop.write","department.marketing.read","department.marketing.write", "erp.read", "erp.purchase", "erp.sales", "erp.stock", "erp.quality", "erp.accounts", "erp.finance.read", "erp.masters", "erp.reverse", "erp.reconcile"];
  const permissions = request.body.permissions;
  if (!Array.isArray(permissions) || permissions.some(p => !allowed.includes(p)&&!(typeof p==="string"&&/^shop\.[A-Za-z0-9_-]{2,60}$/.test(p)))) throw new ApiError(400, "Invalid ERP permissions");
  const user = await User.findOne({ _id: request.params.id, companyId: request.user.companyId, factoryId: request.user.factoryId }).select("+sessionVersion");
  if (!user || user.role === "saas_super_admin") throw new ApiError(404, "Customer user not found");
  user.permissions = [...new Set(permissions)]; user.sessionVersion = Number(user.sessionVersion || 0) + 1;
  await user.save(); response.json({ message: "ERP permissions updated; user must sign in again" });
}

export async function updateProfile(request, response) {
  const updates = {};
  if (request.body.name?.trim()) updates.name = request.body.name.trim();
  if (request.body.email?.trim())
    updates.email = request.body.email.trim().toLowerCase();
  if (request.body.password) {
    assertStrongPassword(request.body.password, { ...request.user, ...updates });
    updates.password = await bcrypt.hash(request.body.password, 12);
    updates.passwordChangedAt = new Date();
  }
  const updateQuery = request.body.password
    ? { $set: updates, $inc: { sessionVersion: 1 } }
    : { $set: updates };
  const user = await User.findByIdAndUpdate(request.user.id, updateQuery, {
    new: true,
    runValidators: true,
  }).select(
    "name email role department permissions active companyId factoryId createdAt",
  );
  if (!user) throw new ApiError(404, "Profile not found");
  response.json(user);
}
