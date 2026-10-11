import "dotenv/config";
import "../src/config/mongoosePlugins.js";
import mongoose from "mongoose";
import TenantRegistry from "../src/models/TenantRegistry.js";
import Candidate from "../src/models/CustomerDatabaseCandidate.js";

// Operator-only recovery. Stop ALL API/worker replicas first. A timeout alone
// does not prove an old database writer is stopped, so no automatic lock reset.
const args = new Map(process.argv.slice(2).map(arg => { const i = arg.indexOf("="); return i < 0 ? [arg, true] : [arg.slice(0, i), arg.slice(i + 1)]; }));
try {
  const key = args.get("--company-key"), action = args.get("--action");
  if (!args.has("--confirm-all-workers-stopped") || !/^[a-z0-9][a-z0-9-]{2,39}$/.test(key || "") || !["resume", "cancel", "clear-requests", "reset-validation"].includes(action)) throw new Error("Usage: --company-key=... --action=resume|cancel|clear-requests|reset-validation --confirm-all-workers-stopped");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const registry = await TenantRegistry.findOne({ companyKey: key }).lean();
  if (!registry) throw new Error("Company not found");
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (action === "reset-validation") {
        if (["MIGRATING", "CUSTOMER"].includes(registry.databaseRoutingState)) throw new Error("Cannot reset validation for live or migrating data");
        const reset = await Candidate.updateOne({ companyKey: key, state: "VALIDATING" }, { $set: { state: "FAILED", lastError: "Validation interrupted; enter the connection again." } }, { session });
        if (reset.matchedCount !== 1) throw new Error("No interrupted validation found");
      } else if (action === "clear-requests") {
        if (registry.databaseRoutingState === "MIGRATING") throw new Error("Resolve migration before clearing request counters");
        await TenantRegistry.updateOne({ _id: registry._id }, { $set: { operationalRequests: 0 } }, { session });
      } else {
        if (registry.databaseRoutingState !== "MIGRATING") throw new Error("Only a pending migration can be resumed or cancelled");
        const candidate = await Candidate.findOne({ companyKey: key, state: "MIGRATING" }).session(session).lean();
        if (!candidate) throw new Error("Migration candidate missing; requires manual review");
        await Candidate.updateOne({ _id: candidate._id }, { $unset: { migrationWorker: 1 }, $set: { lastError: "", ...(action === "cancel" && { state: "FAILED" }) } }, { session });
        if (action === "cancel") await TenantRegistry.updateOne({ _id: registry._id }, { $set: { databaseRoutingState: "PLATFORM", operationalRequests: 0 } }, { session });
      }
    });
  } finally { await session.endSession(); }
  console.log("Recovery recorded. No source or destination records were deleted. Restart services when ready.");
} catch { console.error("Recovery failed. Check arguments and migration state. No database credentials were logged."); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
