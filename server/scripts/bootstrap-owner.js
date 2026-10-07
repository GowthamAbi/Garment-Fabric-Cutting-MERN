import "dotenv/config";
import "../src/config/mongoosePlugins.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDatabase } from "../src/config/database.js";
import { runWithTenant } from "../src/utils/tenantContext.js";
import User from "../src/models/User.js";
import Company from "../src/models/Company.js";
import { assertStrongPassword } from "../src/utils/passwordPolicy.js";

const name = process.env.OWNER_NAME;
const email = process.env.OWNER_EMAIL;
const password = process.env.OWNER_INITIAL_PASSWORD;
try {
  if (!name || !email || !password) throw new Error("Set OWNER_NAME, OWNER_EMAIL and OWNER_INITIAL_PASSWORD privately");
  assertStrongPassword(password, { name, email, userId: "GOWTHAM2131" });
  await connectDatabase();
  await runWithTenant({ companyKey: "platform", databaseName: process.env.CONTROL_DB_NAME || "ugs_control" }, async () => {
    await User.init();
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if (await User.exists({ role: "saas_super_admin" }).session(session))
          throw new Error("Owner already exists; bootstrap will not reset an existing account");
        const [company] = await Company.create([{
          companyName: "UG SaaS",
          factories: [{ name: "Main Factory", code: "MAIN" }],
        }], { session });
        await User.create([{
          userId: "GOWTHAM2131", name, email: email.toLowerCase(),
          password: await bcrypt.hash(password, 12),
          role: "saas_super_admin", emailVerified: true, accountStatus: "ACTIVE",
          companyId: company._id, factoryId: company.factories[0]._id,
        }], { session });
      });
    } finally { await session.endSession(); }
  });
  console.log("Owner created. Login User ID: GOWTHAM2131");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
