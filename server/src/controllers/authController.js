import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import crypto from "node:crypto";
import Company from "../models/Company.js";

function createToken(user) {
  return jwt.sign(
    {
      id: user._id,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      factoryId: user.factoryId,
      permissions: user.permissions,
      department: user.department,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

function createAuthResponse(user, companyName = "Accessories Flow") {
  return {
    token: createToken(user),
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      factoryId: user.factoryId,
      permissions: user.permissions || [],
      department: user.department || "",
      companyName,
    },
  };
}

export async function getSetupStatus(_request, response) {
  response.json({ setupRequired: (await User.countDocuments()) === 0 });
}

export async function register(request, response) {
  const {
    name,
    email,
    password,
    companyName = "Accessories Flow",
    factoryName = "Main Factory",
  } = request.body;

  if (!name || !email || !password) {
    throw new ApiError(400, "Name, email and password are required");
  }

  const userCount = await User.countDocuments();
  if (userCount > 0) {
    throw new ApiError(
      403,
      "Company setup is complete. Ask the admin to create your account",
    );
  }
  if (await User.exists({ email: email.toLowerCase() })) {
    throw new ApiError(409, "Email already registered");
  }

  let company = await Company.findOne();
  if (company) {
    company.companyName = companyName;
    company.factories = [{ name: factoryName, code: "MAIN" }];
    await company.save();
  } else {
    company = await Company.create({
      companyName,
      subscriptionStartsAt: new Date(),
      subscriptionEndsAt: new Date(Date.now() + 14 * 86400000),
      factories: [{ name: factoryName, code: "MAIN" }],
    });
  }
  const user = await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 12),
    role: "saas_super_admin",
    companyId: company._id,
    factoryId: company.factories[0]._id,
  });

  response.status(201).json(createAuthResponse(user, company.companyName));
}

export async function getUsers(_request, response) {
  response.json(
    await User.find()
      .select(
        "name email role department permissions active companyId factoryId createdAt",
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
  const user = await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 12),
    role,
    permissions: request.body.permissions || [],
    department: request.body.department || "",
    companyId: targetCompanyId,
    factoryId: targetFactoryId,
  });
  response.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
}

export async function forgotPassword(request, response) {
  const email = request.body.email?.trim().toLowerCase();
  if (!email) throw new ApiError(400, "Email is required");

  const user = await User.findOne({ email });
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
  user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();

  const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")[0]
    .replace(/\/$/, "");
  const resetUrl = `${clientUrl}/?resetToken=${rawToken}`;

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
        subject: "Accessories Flow password reset",
        html: `<p>Use this link within 30 minutes:</p><p><a href="${resetUrl}">Reset password</a></p>`,
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
  if (!token || !password || password.length < 6) {
    throw new ApiError(
      400,
      "Valid token and minimum 6 character password are required",
    );
  }
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: new Date() },
  });
  if (!user) throw new ApiError(400, "Reset link is invalid or expired");
  user.password = await bcrypt.hash(password, 12);
  user.resetPasswordToken = "";
  user.resetPasswordExpires = undefined;
  await user.save();
  response.json({ message: "Password reset successfully" });
}

export async function login(request, response) {
  const user = await User.findOne({ email: request.body.email?.toLowerCase() });
  const validPassword =
    user && (await bcrypt.compare(request.body.password || "", user.password));

  if (!validPassword) throw new ApiError(401, "Incorrect email or password");
  if (!user.active) throw new ApiError(403, "This user account is disabled");
  const company = await Company.findById(user.companyId).lean();
  if (user.role !== "saas_super_admin") {
    const expired =
      company?.subscriptionEndsAt &&
      new Date(company.subscriptionEndsAt) < new Date();
    if (!company?.active || company?.subscriptionStatus !== "Active" || expired)
      throw new ApiError(402, "Company subscription is inactive or expired");
  }
  response.json(createAuthResponse(user, company?.companyName));
}

export async function getProfile(request, response) {
  const user = await User.findById(request.user.id)
    .select(
      "name email role department permissions active companyId factoryId createdAt",
    )
    .lean();
  if (!user) throw new ApiError(404, "Profile not found");
  response.json(user);
}

export async function updateProfile(request, response) {
  const updates = {};
  if (request.body.name?.trim()) updates.name = request.body.name.trim();
  if (request.body.email?.trim())
    updates.email = request.body.email.trim().toLowerCase();
  if (request.body.password) {
    if (request.body.password.length < 8)
      throw new ApiError(400, "Password must contain at least 8 characters");
    updates.password = await bcrypt.hash(request.body.password, 12);
  }
  const user = await User.findByIdAndUpdate(request.user.id, updates, {
    new: true,
    runValidators: true,
  }).select(
    "name email role department permissions active companyId factoryId createdAt",
  );
  if (!user) throw new ApiError(404, "Profile not found");
  response.json(user);
}
