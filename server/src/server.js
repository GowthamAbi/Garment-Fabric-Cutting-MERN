import "dotenv/config";
import "./config/mongoosePlugins.js";
import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import { validateEnvironment } from "./config/environment.js";
import mongoose from "mongoose";
import { runJobsOnce } from "./automation/worker.js";

validateEnvironment();
await connectDatabase();

const port = process.env.PORT || 5000;

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`UG SaaS API running on port ${port}`);
});
let runningJob = null;
const tick = () => {
  if (runningJob || process.env.AUTOMATION_ENABLED !== "true") return;
  runningJob = runJobsOnce().catch(() => console.error("Automation cycle failed; inspect pending/dead jobs"))
    .finally(() => { runningJob = null; });
};
const timer = setInterval(tick, 60000); timer.unref(); tick();
let stopping = false;
async function shutdown() {
  if (stopping) return; stopping = true; clearInterval(timer);
  const timeout = setTimeout(() => process.exit(1), 45000); timeout.unref();
  await new Promise(resolve => server.close(resolve));
  if (runningJob) await runningJob;
  await mongoose.disconnect(); clearTimeout(timeout);
}
process.on("SIGTERM", shutdown); process.on("SIGINT", shutdown);
