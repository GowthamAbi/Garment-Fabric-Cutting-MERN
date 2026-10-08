import "dotenv/config";
import "../src/config/mongoosePlugins.js";
import mongoose from "mongoose";
import { connectDatabase } from "../src/config/database.js";
import { runJobsOnce } from "../src/automation/worker.js";
await connectDatabase();
try { console.log(await runJobsOnce()); } finally { await mongoose.disconnect(); }
